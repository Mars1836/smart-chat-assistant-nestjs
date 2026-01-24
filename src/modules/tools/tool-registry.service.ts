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
    // Get chatbot tool actions (granular per-action permissions)
    const chatbotToolActions = await this.chatbotToolActionRepo.find({
      where: { chatbot_id: chatbotId, is_enabled: true },
      relations: ['tool', 'tool_action'],
    });

    if (chatbotToolActions.length > 0) {
      // If chatbot has specific action permissions, use those
      return chatbotToolActions
        .filter((cta) => cta.tool_action.is_enabled)
        .map((cta) => ({
          tool: cta.tool,
          action: cta.tool_action,
          config_override: cta.config_override,
        }));
    }

    // Fallback: get all actions from enabled chatbot tools
    const chatbotTools = await this.chatbotToolRepo.find({
      where: { chatbot_id: chatbotId, is_enabled: true },
      relations: ['tool', 'tool.actions'],
    });

    const result: Array<{
      tool: Tool;
      action: ToolAction;
      config_override?: Record<string, any> | null;
    }> = [];

    for (const ct of chatbotTools) {
      if (!ct.tool.is_enabled) continue;

      for (const action of ct.tool.actions || []) {
        if (!action.is_enabled) continue;

        result.push({
          tool: ct.tool,
          action,
          config_override: ct.config_override,
        });
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

    return enabledActions.map(({ tool, action, config_override }) => {
      const normalized = this.normalizeParameters(action.parameters);

      return {
        // Make each action a distinct callable function
        // Example: rag_documents__search
        name: `${tool.name}__${action.name}`,
        description: `${tool.display_name}: ${action.description}`,
        parameters: normalized,
      };
    });
  }

  /**
   * Format tools for LLM (Google AI Studio Function Calling format)
   * @deprecated Use formatForLLMWithPermissions for granular action control
   */
  formatForLLM(tools: Tool[]): any[] {
    return tools.flatMap((tool) => {
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
   * Get all built-in tools
   */
  async getBuiltInTools(): Promise<Tool[]> {
    return await this.toolRepo.find({
      where: { category: 'builtin', is_enabled: true },
      relations: ['actions'],
    });
  }
}
