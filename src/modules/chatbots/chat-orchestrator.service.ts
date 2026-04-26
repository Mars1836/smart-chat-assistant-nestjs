import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import { Chatbot } from './entities/chatbot.entity';
import { Message } from '../messages/entities/message.entity';
import { RagService } from '../rag/rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolExecutorService } from '../tools/tool-executor.service';
import { LLMFactoryService } from '../../common/providers/llm-factory.service';
import { LLMMessage } from '../../common/interfaces/llm-provider.interface';
import { buildCardsFromToolResults } from './card-mappers';
import { BillingService } from '../billing/billing.service';
import { ChatEventsService } from './chat-events.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type GeminiMessage = {
  role: 'user' | 'assistant' | 'function';
  content?: string;
  functionResponse?: { name: string; response: any };
  functionCall?: { name: string; args: any };
};

type GeminiFunctionCall = { name: string; args: any };

/**
 * One step in an LLM-generated execution plan.
 *
 * Completely generic — no domain (calendar, CRM, e-commerce …) is hardcoded.
 * The Planner LLM generates this JSON from the live tool list + user intent.
 *
 * Example – "xóa cuộc họp sáng nay":
 *   [
 *     { index:0, description:"List today's events to get the eventId",
 *       expectedTools:["google_calendar__list_events"], dependsOnPrevious:false },
 *     { index:1, description:"Delete the matched event using the eventId from step 0",
 *       expectedTools:["google_calendar__delete_event"], dependsOnPrevious:true }
 *   ]
 *
 * Example – "tạo đơn hàng cho khách X":
 *   [
 *     { index:0, description:"Find customer X to get customerId",
 *       expectedTools:["crm__find_customer"], dependsOnPrevious:false },
 *     { index:1, description:"Create order using customerId from step 0",
 *       expectedTools:["orders__create_order"], dependsOnPrevious:true }
 *   ]
 */
type PlanStep = {
  index: number;
  description: string;
  expectedTools: string[];
  dependsOnPrevious: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Time-context helper  (pure JS, ~0 ms, no LLM call)
// ─────────────────────────────────────────────────────────────────────────────

function buildTimeContext(timezone = 'Asia/Ho_Chi_Minh'): string {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone }),
  );
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isoTime = (d: Date, h: number, m: number) =>
    `${isoDate(d)}T${pad(h)}:${pad(m)}:00`;

  const dayNames = [
    'Chủ nhật',
    'Thứ hai',
    'Thứ ba',
    'Thứ tư',
    'Thứ năm',
    'Thứ sáu',
    'Thứ bảy',
  ];
  const dow = now.getDay();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (dow === 0 ? 0 : 7 - dow));
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + (dow === 0 ? 1 : 8 - dow));

  return [
    `[TIME CONTEXT – always derive datetime tool parameters from this table]`,
    `Timezone  : ${timezone}`,
    `Now       : ${now.toISOString().slice(0, 19)} (${dayNames[dow]})`,
    `Today     : ${isoDate(now)}`,
    `Yesterday : ${isoDate(yesterday)}`,
    `Tomorrow  : ${isoDate(tomorrow)}`,
    `Week start (Mon): ${isoDate(startOfWeek)}   Week end (Sun): ${isoDate(endOfWeek)}`,
    `Next Monday     : ${isoDate(nextMonday)}`,
    ``,
    `Default time slots when user says "sáng / chiều / tối" without exact time:`,
    `  Morning   : ${isoTime(now, 9, 0)} → ${isoTime(now, 10, 0)}`,
    `  Afternoon : ${isoTime(now, 14, 0)} → ${isoTime(now, 15, 0)}`,
    `  Evening   : ${isoTime(now, 19, 0)} → ${isoTime(now, 20, 0)}`,
    ``,
    `RULE: derive ALL datetime params from this table. Never guess year/month independently.`,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph state
// ─────────────────────────────────────────────────────────────────────────────

const ChatGraphState = Annotation.Root({
  // ── Core inputs ────────────────────────────────────────────────────────────
  workspaceId: Annotation<string>,
  chatbotId: Annotation<string>,
  userId: Annotation<string>,
  conversationId: Annotation<string>,
  userMessage: Annotation<string>,
  chatbot: Annotation<Chatbot>,

  // ── Prepared data ──────────────────────────────────────────────────────────
  tools: Annotation<any[]>({
    reducer: (_l: any[], r: any[]) => r,
    default: () => [],
  }),
  systemInstruction: Annotation<string>,
  timeContext: Annotation<string>({
    reducer: (_l: string, r: string) => r ?? '',
    default: () => '',
  }),

  // ── Conversation history ───────────────────────────────────────────────────
  geminiMessages: Annotation<GeminiMessage[]>({
    reducer: (l: GeminiMessage[], r: GeminiMessage | GeminiMessage[]) =>
      l.concat(Array.isArray(r) ? r : [r]),
    default: () => [],
  }),

  // ── Tool orchestration ─────────────────────────────────────────────────────
  functionCalls: Annotation<GeminiFunctionCall[] | null>({
    reducer: (
      _l: GeminiFunctionCall[] | null,
      r: GeminiFunctionCall[] | null,
    ) => r,
    default: () => null,
  }),

  // ── Plan (LLM-generated, fully generic) ───────────────────────────────────
  executionPlan: Annotation<PlanStep[]>({
    reducer: (_l: PlanStep[], r: PlanStep[]) => r,
    default: () => [],
  }),
  currentPlanStep: Annotation<number>({
    reducer: (_l: number, r: number) => r,
    default: () => 0,
  }),
  /** Results per plan-step index; chained into next step's router prompt */
  planStepResults: Annotation<Record<number, any[]>>({
    reducer: (l: Record<number, any[]>, r: Record<number, any[]>) => ({
      ...l,
      ...r,
    }),
    default: () => ({}),
  }),

  // ── Output accumulators ────────────────────────────────────────────────────
  finalResponse: Annotation<string>({
    reducer: (_l: string, r: string) => r,
    default: () => '',
  }),
  turn: Annotation<number>({
    reducer: (_l: number, r: number) => r,
    default: () => 0,
  }),
  toolRunCount: Annotation<number>({
    reducer: (_l: number, r: number) => r,
    default: () => 0,
  }),
  files: Annotation<any[]>({
    reducer: (l: any[], r: any[]) => l.concat(Array.isArray(r) ? r : [r]),
    default: () => [],
  }),
  cards: Annotation<any[]>({
    reducer: (_l: any[], r: any[]) => (Array.isArray(r) ? r : []),
    default: () => [],
  }),
  totalInputTokens: Annotation<number>({
    reducer: (l: number, r: number) => l + (r ?? 0),
    default: () => 0,
  }),
  totalOutputTokens: Annotation<number>({
    reducer: (l: number, r: number) => l + (r ?? 0),
    default: () => 0,
  }),
  toolsUsedLog: Annotation<
    { tool_name: string; args: Record<string, any>; result: any }[]
  >({
    reducer: (l, r) => l.concat(Array.isArray(r) ? r : []),
    default: () => [],
  }),

  // ── Misc ──────────────────────────────────────────────────────────────────
  maxTurns: Annotation<number>({
    reducer: (_l: number, r: number) => r,
    default: () => 10,
  }),
  extractedImageContent: Annotation<string>({
    reducer: (_l: string, r: string) => r ?? '',
    default: () => '',
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);

  private readonly graph = new StateGraph(ChatGraphState)

    // ══════════════════════════════════════════════════════════════════════════
    // NODE 1 – prepare_state
    //
    // Replaces old serial prepare_tools → prepare_history → prepare_knowledge.
    // Tools + history fetched in parallel. Time context built in pure JS.
    // ══════════════════════════════════════════════════════════════════════════
    .addNode('prepare_state', async (state: typeof ChatGraphState.State) => {
      const [tools, history] = await Promise.all([
        this.toolRegistryService.formatForLLMWithPermissions(state.chatbotId),
        this.messageRepo.find({
          where: { conversation: { id: state.conversationId } },
          order: { created_at: 'DESC' },
          take: state.chatbot.max_context_turns * 2,
          select: ['id', 'content', 'sender_type', 'created_at'],
        }),
      ]);

      history.reverse();

      const mapped: GeminiMessage[] = history.map((m) => ({
        role: m.sender_type === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      let currentUserContent = state.userMessage;
      if (state.extractedImageContent?.trim()) {
        currentUserContent +=
          '\n\n[Content from attached image(s)]: ' +
          state.extractedImageContent.trim();
      }

      const last = mapped.at(-1);
      if (!last || last.role !== 'user' || last.content !== state.userMessage) {
        mapped.push({ role: 'user', content: currentUserContent });
      } else {
        mapped[mapped.length - 1].content = currentUserContent;
      }

      return {
        tools,
        geminiMessages: mapped,
        systemInstruction: this.buildSystemInstruction(state.chatbot),
        timeContext: buildTimeContext('Asia/Ho_Chi_Minh'),
      };
    })

    // ══════════════════════════════════════════════════════════════════════════
    // NODE 2 – planner_step
    //
    // A small, fast LLM call that:
    //   1. Receives the real tool list (names + descriptions only, no full schema)
    //   2. Receives the user message
    //   3. Returns a JSON array of PlanStep[]
    //
    // It knows NOTHING about specific domains — it reasons purely from tool
    // descriptions and user intent. Adding a new tool/plugin requires zero
    // changes here; the planner adapts automatically.
    //
    // Optimisations:
    //   • Only name + description sent (not full JSON schema) → small prompt
    //   • temperature:0 + maxTokens:400 → fast, deterministic
    //   • Failure is non-fatal → falls back to single-step execution
    // ══════════════════════════════════════════════════════════════════════════
    .addNode('planner_step', async (state: typeof ChatGraphState.State) => {
      this.chatEventsService.emit({
        type: 'planning',
        conversation_id: state.conversationId,
        chatbot_id: state.chatbotId,
        timestamp: new Date().toISOString(),
        message: 'Planning tool execution',
      });

      // Fast-path: nothing to plan without tools
      if (!state.tools?.length) {
        return { executionPlan: [], currentPlanStep: 0 };
      }

      const provider = this.llmFactory.getProvider(state.chatbot.llm_model);

      // Compact tool summary — name + description only
      const toolSummary = state.tools
        .map((t: any) => {
          const name = t.name ?? t.function?.name ?? '?';
          const desc =
            t.description ?? t.function?.description ?? '(no description)';
          return `- ${name}: ${desc}`;
        })
        .join('\n');

      const plannerSystem = [
        `[ROLE: PLANNER AGENT]`,
        `Analyze the user request and the available tools below.`,
        `Decide whether the request requires ONE step or MULTIPLE sequential steps to complete.`,
        ``,
        `AVAILABLE TOOLS:`,
        toolSummary,
        ``,
        state.timeContext,
        ``,
        `OUTPUT: respond ONLY with a valid JSON array — no markdown fences, no extra text.`,
        `Schema of each element:`,
        `{`,
        `  "index": <number, 0-based>,`,
        `  "description": "<what to do in this step>",`,
        `  "expectedTools": ["<exact_tool_name>", ...],`,
        `  "dependsOnPrevious": <true|false>`,
        `}`,
        ``,
        `RULES:`,
        `1. Single-step  → return ONE element array.`,
        `2. Multi-step   → return elements in execution ORDER.`,
        `   Use multi-step when a later action REQUIRES data (e.g. an ID) from an earlier action.`,
        `   Example pattern: search/list first → then act on result (update/delete/create with FK).`,
        `3. dependsOnPrevious=true means this step needs output from the previous step.`,
        `4. Use EXACT tool names from the list above.`,
        `5. Return [] ONLY if the request needs no tools at all (pure conversation).`,
        `6. Do NOT add unnecessary steps. Keep the plan as short as possible.`,
        `7. Output must be parseable by JSON.parse(). No trailing commas.`,
      ].join('\n');

      let executionPlan: PlanStep[] = [];

      try {
        const response = await provider.chat(
          state.chatbot.llm_model,
          [{ role: 'user', content: state.userMessage }] as LLMMessage[],
          {
            temperature: 0,
            maxTokens: 400,
            systemInstruction: plannerSystem,
            // No tools — planner outputs plain JSON text only
          },
        );

        await this.chargeUsage(state, response.usage, 'planner');

        // Strip possible markdown fences before parsing
        const cleaned = (response.text ?? '')
          .trim()
          .replace(/^```(?:json)?/i, '')
          .replace(/```$/, '')
          .trim();

        const parsed = JSON.parse(cleaned);

        if (Array.isArray(parsed)) {
          executionPlan = parsed
            .filter((s: any) => typeof s.index === 'number' && s.description)
            .map((s: any, i: number) => ({
              index: i,
              description: String(s.description),
              expectedTools: Array.isArray(s.expectedTools)
                ? s.expectedTools
                : [],
              dependsOnPrevious: Boolean(s.dependsOnPrevious),
            }));
        }

        this.logger.log(
          `[planner_step] plan: ${JSON.stringify(executionPlan)}`,
        );
      } catch (err) {
        // Non-fatal: fall back to single-step (router decides tools on its own)
        this.logger.warn(
          `[planner_step] parse failed, falling back to single-step: ${err}`,
        );
        executionPlan = [];
      }

      return { executionPlan, currentPlanStep: 0 };
    })

    // ══════════════════════════════════════════════════════════════════════════
    // NODE 3 – router_step
    //
    // Decides WHICH tools to call and with WHAT args for the current plan step.
    // • No chatbot personality — that lives only in answer_step.
    // • Reads current plan step description + previous step results from state.
    // • temperature:0 + maxTokens:512 → fast, deterministic.
    // ══════════════════════════════════════════════════════════════════════════
    .addNode('router_step', async (state: typeof ChatGraphState.State) => {
      this.chatEventsService.emit({
        type: 'routing',
        conversation_id: state.conversationId,
        chatbot_id: state.chatbotId,
        timestamp: new Date().toISOString(),
        step: state.currentPlanStep,
        message: 'Selecting next action',
      });

      const nextTurn = state.turn + 1;
      const provider = this.llmFactory.getProvider(state.chatbot.llm_model);
      const messages = this.toProviderMessages(state.geminiMessages);

      const routerLines = [
        `[ROLE: TOOL ROUTER]`,
        `Your ONLY job: decide which tool(s) to call and with what exact parameters.`,
        `Do NOT answer the user. Do NOT explain. Only emit function calls.`,
        `If no tool is needed for this step, emit nothing.`,
        ``,
        state.timeContext,
      ];

      // Inject plan-step context when a multi-step plan exists
      const plan = state.executionPlan;
      if (plan.length > 1) {
        const step = plan[state.currentPlanStep];
        if (step) {
          routerLines.push(
            ``,
            `[EXECUTION PLAN – Step ${step.index + 1} of ${plan.length}]`,
            `Task : ${step.description}`,
            `Tools: ${step.expectedTools.join(', ') || '(router decides)'}`,
          );

          // Pass previous step results for ID / data chaining
          if (step.dependsOnPrevious && state.currentPlanStep > 0) {
            const prev = state.planStepResults[state.currentPlanStep - 1] ?? [];
            if (prev.length) {
              routerLines.push(
                ``,
                `Output from previous step (extract IDs or values you need):`,
                JSON.stringify(prev, null, 2),
              );
            }
          }
        }
      }

      const response = await provider.chat(state.chatbot.llm_model, messages, {
        temperature: 0,
        maxTokens: 512,
        systemInstruction: routerLines.join('\n'),
        tools: state.tools as any,
      });

      await this.chargeUsage(state, response.usage, 'router');

      const tokenUpdate = this.extractTokenUpdate(response.usage);

      if ((response.functionCalls?.length ?? 0) > 0) {
        const calls = response.functionCalls as GeminiFunctionCall[];
        const callMsgs: GeminiMessage[] = calls.map((c) => ({
          role: 'assistant',
          functionCall: { name: c.name, args: c.args },
        }));

        return {
          turn: nextTurn,
          functionCalls: calls,
          geminiMessages: callMsgs,
          ...tokenUpdate,
        };
      }

      return { turn: nextTurn, functionCalls: null, ...tokenUpdate };
    })

    // ══════════════════════════════════════════════════════════════════════════
    // NODE 4 – execute_tools
    //
    // Runs all pending function calls in parallel (single retry per call).
    // Stores results in planStepResults[currentPlanStep] for context chaining.
    // ══════════════════════════════════════════════════════════════════════════
    .addNode('execute_tools', async (state: typeof ChatGraphState.State) => {
      const calls = state.functionCalls ?? [];
      if (!calls.length) return { functionCalls: null };

      const ctx = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        sessionId: state.conversationId,
        chatbotId: state.chatbotId,
      };

      calls.forEach((call) => {
        this.chatEventsService.emit({
          type: 'tool_started',
          conversation_id: state.conversationId,
          chatbot_id: state.chatbotId,
          timestamp: new Date().toISOString(),
          tool_name: call.name,
          args: call.args ?? {},
          step: state.currentPlanStep,
          message: `Executing ${call.name}`,
        });
      });

      // Parallel execution with one retry on failure
      const results = await Promise.all(
        calls.map(async (call) => {
          try {
            return await this.toolExecutorService.execute(
              call.name,
              call.args,
              ctx,
            );
          } catch (_e) {
            try {
              return await this.toolExecutorService.execute(
                call.name,
                call.args,
                ctx,
              );
            } catch (e2: any) {
              return { error: e2?.message ?? String(e2) };
            }
          }
        }),
      );

      this.logger.log(
        `[execute_tools] step=${state.currentPlanStep} results=${JSON.stringify(results)}`,
      );

      calls.forEach((call, index) => {
        const result = results[index];

        if (result?.error) {
          this.chatEventsService.emit({
            type: 'tool_failed',
            conversation_id: state.conversationId,
            chatbot_id: state.chatbotId,
            timestamp: new Date().toISOString(),
            tool_name: call.name,
            args: call.args ?? {},
            error: String(result.error),
            step: state.currentPlanStep,
            message: `${call.name} failed`,
          });
          return;
        }

        this.chatEventsService.emit({
          type: 'tool_succeeded',
          conversation_id: state.conversationId,
          chatbot_id: state.chatbotId,
          timestamp: new Date().toISOString(),
          tool_name: call.name,
          args: call.args ?? {},
          result,
          step: state.currentPlanStep,
          message: `${call.name} completed`,
        });
      });

      // ── Collect files ──────────────────────────────────────────────────────
      const files: any[] = results
        .filter((r) => r?.url && (r.filename || r.path))
        .map((r) => {
          const filename = r.filename || 'download';
          const isImage =
            r.mime_type?.startsWith('image/') ||
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
          return {
            type: isImage ? 'image' : 'file',
            url: r.url,
            filename,
            size: r.size,
            mime_type: r.mime_type,
          };
        });

      // ── Function-response messages for next LLM call ───────────────────────
      const fnResponses: GeminiMessage[] = calls.map((call, i) => ({
        role: 'function',
        functionResponse: { name: call.name, response: results[i] },
      }));

      // ── Tools-used audit log ───────────────────────────────────────────────
      const toolsUsedLog = calls.map((call, i) => ({
        tool_name: call.name,
        args: call.args ?? {},
        result: results[i],
      }));

      // ── Cards (parallel config fetch) ─────────────────────────────────────
      const cardConfigByCall = new Map<string, any>();
      await Promise.all(
        calls.map(async (call) => {
          const sep = call.name.indexOf('__');
          if (sep > 0) {
            const cfg = await this.toolRegistryService.getCardConfig(
              call.name.slice(0, sep),
              call.name.slice(sep + 2),
            );
            if (cfg) cardConfigByCall.set(call.name, cfg);
          }
        }),
      );

      const cards = buildCardsFromToolResults(
        calls,
        results,
        {
          shopFrontendUrl: this.configService?.get<string>('SHOP_FRONTEND_URL'),
        },
        { cardConfigByCall },
      );

      // ── Advance plan step ──────────────────────────────────────────────────
      return {
        functionCalls: null,
        geminiMessages: fnResponses,
        files,
        cards,
        toolRunCount: state.toolRunCount + 1,
        toolsUsedLog,
        planStepResults: { [state.currentPlanStep]: results },
        currentPlanStep: state.currentPlanStep + 1,
      };
    })

    // ══════════════════════════════════════════════════════════════════════════
    // NODE 5 – answer_step
    //
    // Synthesizes everything in geminiMessages into a final user-facing reply.
    // Full chatbot personality applied here. No tools passed → cannot loop back.
    // ══════════════════════════════════════════════════════════════════════════
    .addNode('answer_step', async (state: typeof ChatGraphState.State) => {
      this.chatEventsService.emit({
        type: 'assistant_responding',
        conversation_id: state.conversationId,
        chatbot_id: state.chatbotId,
        timestamp: new Date().toISOString(),
        message: 'Generating final answer',
      });

      const nextTurn = state.turn + 1;
      const provider = this.llmFactory.getProvider(state.chatbot.llm_model);
      const messages = this.toProviderMessages(state.geminiMessages);

      const answerSystem = [
        state.systemInstruction || '',
        ``,
        `[ROLE: ANSWER AGENT]`,
        `Read the full conversation including all tool results (function responses).`,
        `Write the FINAL answer for the user. Do NOT call any tools.`,
        `Be clear, concise, and helpful.`,
        ``,
        state.timeContext,
      ].join('\n');

      const response = await provider.chat(state.chatbot.llm_model, messages, {
        temperature: state.chatbot.temperature,
        maxTokens: state.chatbot.max_tokens,
        systemInstruction: answerSystem,
        // No tools → model cannot emit function calls
      });

      await this.chargeUsage(state, response.usage, 'answer');

      if ((response.functionCalls?.length ?? 0) > 0) {
        const calls = response.functionCalls as GeminiFunctionCall[];
        const callMsgs: GeminiMessage[] = calls.map((c) => ({
          role: 'assistant',
          functionCall: { name: c.name, args: c.args },
        }));

        return {
          turn: nextTurn,
          functionCalls: calls,
          geminiMessages: callMsgs,
          ...this.extractTokenUpdate(response.usage),
        };
      }

      return {
        turn: nextTurn,
        functionCalls: null,
        finalResponse: response.text ?? '',
        ...this.extractTokenUpdate(response.usage),
      };
    })

    // ══════════════════════════════════════════════════════════════════════════
    // NODE 6 – finalize
    // ══════════════════════════════════════════════════════════════════════════
    .addNode('finalize', async (state: typeof ChatGraphState.State) => {
      if (state.finalResponse?.trim()) return {};
      return {
        finalResponse:
          state.chatbot.fallback_message ??
          'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.',
      };
    })

    // ── Edges ──────────────────────────────────────────────────────────────────

    .addEdge(START, 'prepare_state')
    .addEdge('prepare_state', 'planner_step')
    .addEdge('planner_step', 'router_step')

    // router_step → execute_tools | answer_step | finalize
    .addConditionalEdges(
      'router_step',
      (state: typeof ChatGraphState.State) => {
        if (state.turn >= state.maxTurns) return 'finalize';
        if ((state.functionCalls?.length ?? 0) > 0) return 'execute_tools';
        return 'answer_step';
      },
      {
        execute_tools: 'execute_tools',
        answer_step: 'answer_step',
        finalize: 'finalize',
      },
    )

    // execute_tools → router_step (next plan step) | answer_step | finalize
    .addConditionalEdges(
      'execute_tools',
      (state: typeof ChatGraphState.State) => {
        if (state.turn >= state.maxTurns) return 'finalize';
        // More plan steps remaining → route back so router handles next step
        if (
          state.executionPlan.length > 1 &&
          state.currentPlanStep < state.executionPlan.length
        ) {
          return 'router_step';
        }
        return 'answer_step';
      },
      {
        router_step: 'router_step',
        answer_step: 'answer_step',
        finalize: 'finalize',
      },
    )

    .addConditionalEdges(
      'answer_step',
      (state: typeof ChatGraphState.State) => {
        if (state.turn >= state.maxTurns) return 'finalize';
        if ((state.functionCalls?.length ?? 0) > 0) return 'execute_tools';
        return 'finalize';
      },
      { execute_tools: 'execute_tools', finalize: 'finalize' },
    )
    .addEdge('finalize', END)
    .compile();

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly llmFactory: LLMFactoryService,
    private readonly ragService: RagService,
    private readonly knowledgeService: KnowledgeService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly toolExecutorService: ToolExecutorService,
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
    private readonly chatEventsService: ChatEventsService,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async runChatTurn(params: {
    workspaceId: string;
    chatbotId: string;
    userId: string;
    conversationId: string;
    userMessage: string;
    chatbot: Chatbot;
    extractedImageContent?: string;
  }): Promise<{
    response: string;
    turns: number;
    files: any[];
    cards: any[];
    tokenUsage?: { input_tokens: number; output_tokens: number };
    toolsUsed: { tool_name: string; args: Record<string, any>; result: any }[];
  }> {
    const result = await this.graph.invoke({
      ...params,
      extractedImageContent: params.extractedImageContent ?? '',
      systemInstruction: '',
      timeContext: '',
      geminiMessages: [],
      tools: [],
      functionCalls: null,
      finalResponse: '',
      turn: 0,
      maxTurns: 10,
      files: [],
      cards: [],
      toolRunCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      toolsUsedLog: [],
      executionPlan: [],
      currentPlanStep: 0,
      planStepResults: {},
    });

    const tokenUsage =
      (result.totalInputTokens ?? 0) > 0 || (result.totalOutputTokens ?? 0) > 0
        ? {
            input_tokens: result.totalInputTokens,
            output_tokens: result.totalOutputTokens,
          }
        : undefined;

    return {
      response: result.finalResponse,
      turns: result.turn,
      files: result.files ?? [],
      cards: result.cards ?? [],
      tokenUsage,
      toolsUsed: result.toolsUsedLog ?? [],
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** GeminiMessage[] → provider-agnostic LLMMessage[]. */
  private toProviderMessages(msgs: GeminiMessage[]): LLMMessage[] {
    return msgs.map((msg) => {
      const fnRes =
        msg.functionResponse ?? (msg as any).parts?.[0]?.functionResponse;
      return {
        role: msg.role as any,
        content: msg.content ?? (msg as any).parts?.[0]?.text,
        functionResponse: fnRes
          ? { name: fnRes.name, response: fnRes.response }
          : undefined,
      };
    });
  }

  /** Token delta for state accumulation. */
  private extractTokenUpdate(usage: any): object {
    if (!usage) return {};
    return {
      totalInputTokens: usage.input_tokens ?? 0,
      totalOutputTokens: usage.output_tokens ?? 0,
    };
  }

  /** Charges LLM usage to billing. Non-blocking — errors logged, not thrown. */
  private async chargeUsage(
    state: typeof ChatGraphState.State,
    usage: any,
    phase: string,
  ): Promise<void> {
    if (!state.workspaceId) {
      this.logger.warn(
        `[chargeUsage][${phase}] skipped: no workspaceId on state — billing will not run`,
      );
      return;
    }
    if (!usage) {
      this.logger.warn(
        `[chargeUsage][${phase}] skipped: LLM response has no usage (input/output tokens) — billing will not run`,
      );
      return;
    }
    try {
      await this.billingService.chargeUsage(
        state.workspaceId,
        state.chatbot.llm_provider,
        state.chatbot.llm_model,
        {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        },
        {
          conversationId: state.conversationId,
          chatbotId: state.chatbotId,
          phase,
        },
        state.userId,
      );
    } catch (err) {
      this.logger.error(
        `[chargeUsage][${phase}] workspace=${state.workspaceId}`,
        err,
      );
    }
  }

  /**
   * Base system instruction — personality + language + UX rules only.
   * Router and Planner use their own separate, focused system prompts.
   */
  private buildSystemInstruction(chatbot: Chatbot): string {
    const parts: string[] = [];

    if (chatbot.personality) parts.push(chatbot.personality);

    parts.push(`Bạn đang trả lời bằng ngôn ngữ: ${chatbot.language}`);

    if (chatbot.greeting_message) {
      parts.push(`Tin nhắn chào: "${chatbot.greeting_message}"`);
    }

    parts.push(
      'Trả lời ngắn gọn, rõ ràng, hữu ích. Nếu không chắc, hãy thừa nhận và đề xuất hướng khác.',
      'Không hỏi lại người dùng — chỉ dùng thông tin đã có trong hội thoại.',
      'Nếu tin nhắn có "[Content from attached image(s)]", đó là văn bản trích xuất từ ảnh — dùng trực tiếp, không yêu cầu URL ảnh.',
    );

    return parts.join('\n');
  }
}
