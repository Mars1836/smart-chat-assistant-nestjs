import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { ToolAction } from './entities/tool-action.entity';
import { ChatbotTool } from './entities/chatbot-tool.entity';
import { ChatbotToolAction } from './entities/chatbot-tool-action.entity';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,
    @InjectRepository(ToolAction)
    private readonly toolActionRepo: Repository<ToolAction>,
    @InjectRepository(ChatbotTool)
    private readonly chatbotToolRepo: Repository<ChatbotTool>,
    @InjectRepository(ChatbotToolAction)
    private readonly chatbotToolActionRepo: Repository<ChatbotToolAction>,
  ) {}

  /**
   * Get all enabled tools for a chatbot
   */
  async getToolsForChatbot(chatbotId: string): Promise<Tool[]> {
    const chatbotTools = await this.chatbotToolRepo.find({
      where: { chatbot_id: chatbotId, is_enabled: true },
      relations: ['tool', 'tool.actions'],
    });

    return chatbotTools
      .map((ct) => ct.tool)
      .filter((tool) => tool.is_enabled);
  }

  /**
   * Get enabled actions for a chatbot (respecting per-action permissions)
   */
  async getEnabledActionsForChatbot(chatbotId: string): Promise<
    Array<{
      tool: Tool;
      action: ToolAction;
      config_override?: Record<string, any> | null;
    }>
  > {
    // 1. Get all enabled tools for this chatbot
    const chatbotTools = await this.chatbotToolRepo.find({
      where: { chatbot_id: chatbotId, is_enabled: true },
      relations: ['tool', 'tool.actions'],
    });

    // 2. Get all specific action configurations for this chatbot
    const chatbotToolActions = await this.chatbotToolActionRepo.find({
      where: { chatbot_id: chatbotId },
      relations: ['tool_action'],
    });

    // Map for quick lookup: actionId -> ChatbotToolAction
    const actionConfigMap = new Map<string, ChatbotToolAction>();
    for (const cta of chatbotToolActions) {
      actionConfigMap.set(cta.tool_action_id, cta);
    }

    const result: Array<{
      tool: Tool;
      action: ToolAction;
      config_override?: Record<string, any> | null;
    }> = [];

    for (const ct of chatbotTools) {
      if (!ct.tool.is_enabled) {
        this.logger.debug(`Tool ${ct.tool.name} is disabled (system-wide)`);
        continue;
      }

      this.logger.debug(`Checking actions for tool: ${ct.tool.name}, action count: ${ct.tool.actions?.length}`);

      for (const action of ct.tool.actions || []) {
        if (action.is_enabled === false) {
           this.logger.debug(`Action ${action.name} is disabled (system-wide)`);
           continue;
        }

        // Check specific permission
        const cta = actionConfigMap.get(action.id);
        
        // If specific config exists, use its is_enabled. 
        // If NO specific config exists, default to true (since tool is enabled).
        const isActionEnabled = cta ? cta.is_enabled : true;

        this.logger.debug(`Action ${action.name} of tool ${ct.tool.name} -> Specific Config: ${!!cta}, Final Enabled: ${isActionEnabled}`);

        if (isActionEnabled) {
          result.push({
            tool: ct.tool,
            action,
            config_override: cta?.config_override ?? ct.config_override,
          });
        }
      }
    }

    return result;
  }

  /**
   * Get tools for chatbot with ChatbotTool metadata (is_enabled, config_override)
   */
  async getToolsForChatbotWithMetadata(chatbotId: string): Promise<
    Array<{
      tool: Tool;
      chatbot_tool: {
        id: string;
        is_enabled: boolean;
        config_override: Record<string, any> | null;
      };
      enabled_actions: Array<{
        action: ToolAction;
        is_enabled: boolean;
        config_override: Record<string, any> | null;
      }>;
    }>
  > {
    const chatbotTools = await this.chatbotToolRepo.find({
      where: { chatbot_id: chatbotId },
      relations: ['tool', 'tool.actions'],
    });

    // Get all chatbot tool actions for this chatbot
    const chatbotToolActions = await this.chatbotToolActionRepo.find({
      where: { chatbot_id: chatbotId },
    });

    // Create a map for quick lookup
    const actionConfigMap = new Map<string, ChatbotToolAction>();
    for (const cta of chatbotToolActions) {
      actionConfigMap.set(cta.tool_action_id, cta);
    }

    return chatbotTools.map((ct) => ({
      tool: ct.tool,
      chatbot_tool: {
        id: ct.id,
        is_enabled: ct.is_enabled,
        config_override: ct.config_override,
      },
      enabled_actions: (ct.tool.actions || []).map((action) => {
        const cta = actionConfigMap.get(action.id);
        return {
          action,
          is_enabled: cta?.is_enabled ?? true, // Default to enabled if no specific config
          config_override: cta?.config_override ?? null,
        };
      }),
    }));
  }

  /**
   * Format tools for LLM (Google AI Studio Function Calling format)
   * Uses granular action permissions
   */
  async formatForLLMWithPermissions(chatbotId: string): Promise<any[]> {
    const enabledActions = await this.getEnabledActionsForChatbot(chatbotId);

    const functionDeclarations = enabledActions.map(
      ({ tool, action, config_override }) => {
        const normalized = this.normalizeParameters(action.parameters);

        return {
          // Make each action a distinct callable function
          // Example: rag_documents__search
          name: `${tool.name}__${action.name}`,
          description: `${tool.display_name}: ${action.description}`,
          parameters: normalized,
        };
      },
    );

    // Thêm builtin tool knowledge_search – luôn khả dụng cho mọi chatbot, không cần add qua workspace
    functionDeclarations.push(this.getBuiltinKnowledgeSearchTool());

    return functionDeclarations;
  }

  /**
   * Format tools for LLM (Google AI Studio Function Calling format)
   * @deprecated Use formatForLLMWithPermissions for granular action control
   */
  formatForLLM(tools: Tool[]): any[] {
    const dbTools = tools.flatMap((tool) => {
      const actions = tool.actions ?? [];

      return actions
        .filter((action) => action.is_enabled)
        .map((action) => {
          const normalized = this.normalizeParameters(action.parameters);

          return {
            // Make each action a distinct callable function
            // Example: rag_documents__search
            name: `${tool.name}__${action.name}`,
            description: `${tool.display_name}: ${action.description}`,
            parameters: normalized,
          };
        });
    });

    // Deprecated path vẫn thêm builtin knowledge_search để tương thích
    return [...dbTools, this.getBuiltinKnowledgeSearchTool()];
  }

  /**
   * Normalize action.parameters into a JSON-schema-like object:
   * { type: 'OBJECT', properties: {...}, required?: [...] }
   */
  private normalizeParameters(parameters: any): {
    type: 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  } {
    if (!parameters) {
      return { type: 'OBJECT', properties: {}, required: [] };
    }

    // If already schema-like
    if (parameters.type && parameters.properties) {
      return {
        type: 'OBJECT',
        properties: parameters.properties ?? {},
        required: parameters.required ?? [],
      };
    }

    // Legacy shape: { field: {type, description}, ... }
    return {
      type: 'OBJECT',
      properties: parameters,
      required: [],
    };
  }

  /**
   * Builtin knowledge_search tool – không lưu trong DB, luôn khả dụng cho mọi chatbot.
   * Dùng để agent chủ động gọi RAG search khi cần.
   */
  private getBuiltinKnowledgeSearchTool(): any {
    return {
      name: 'knowledge_search',
      description:
        'Search workspace knowledge bases using RAG. Use when you need factual information from uploaded documents or knowledge bases instead of guessing.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'string',
            description:
              'User question or rewritten search query to look up in knowledge bases.',
          },
          top_k: {
            type: 'number',
            description:
              'Maximum number of relevant chunks to return (default 5).',
          },
          min_score: {
            type: 'number',
            description:
              'Optional minimum similarity score (0-1). If not provided, use chatbot default.',
          },
          knowledge_ids: {
            type: 'array',
            description:
              'Optional list of knowledge base IDs to restrict search to. If omitted, search across all knowledge bases in the workspace.',
            items: {
              type: 'string',
            },
          },
        },
        required: ['query'],
      },
    };
  }

  /**
   * Get a tool by name
   */
  async getToolByName(name: string): Promise<Tool | null> {
    return await this.toolRepo.findOne({
      where: { name },
      relations: ['actions'],
    });
  }

  /**
   * Get a tool action by tool name and action name
   */
  async getToolAction(
    toolName: string,
    actionName: string,
  ): Promise<{ tool: Tool; action: ToolAction } | null> {
    const tool = await this.getToolByName(toolName);
    if (!tool) return null;

    const action = tool.actions?.find((a) => a.name === actionName);
    if (!action) return null;

    return { tool, action };
  }

  /**
   * Lấy card_config của action (plugin đánh dấu action trả về list → hiển thị card).
   * Dùng với call name dạng "tool__action" (tách thành toolName, actionName).
   */
  async getCardConfig(
    toolName: string,
    actionName: string,
  ): Promise<{
    enabled?: boolean;
    list_path?: string;
    field_mapping?: Record<string, string>;
  } | null> {
    const pair = await this.getToolAction(toolName, actionName);
    return pair?.action?.card_config ?? null;
  }

  /**
   * Get all built-in tools
   */
  async getBuiltInTools(): Promise<Tool[]> {
    return await this.toolRepo.find({
      where: { category: 'builtin', is_enabled: true },
      relations: ['actions'],
    });
  }
}
