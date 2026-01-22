import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { ToolAction } from './entities/tool-action.entity';
import { ToolExecutionLog } from './entities/tool-execution-log.entity';
import { BaseToolExecutor, ExecutionContext } from './executors/base-executor';
import { RagExecutor } from './executors/rag-executor';
import { FunctionExecutor } from './executors/function-executor';
import { GenericApiExecutor } from './executors/generic-api-executor';
import { RagService } from '../rag/rag.service';
import { OAuthService } from './oauth.service';

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);
  private executors: Map<string, BaseToolExecutor> = new Map();

  constructor(
    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,
    @InjectRepository(ToolAction)
    private readonly toolActionRepo: Repository<ToolAction>,
    @InjectRepository(ToolExecutionLog)
    private readonly logRepo: Repository<ToolExecutionLog>,
    private readonly ragService: RagService,
    private readonly oauthService: OAuthService,
  ) {}

  /**
   * Execute a tool by name
   */
  async execute(
    toolName: string,
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<any> {
    // Support calling a specific action via "tool__action" (Coze-like)
    const [baseToolName, actionNameFromCall] = toolName.includes('__')
      ? (toolName.split('__', 2) as [string, string])
      : ([toolName, undefined] as [string, string | undefined]);

    const tool = await this.toolRepo.findOne({
      where: { name: baseToolName },
      relations: ['actions'],
    });

    if (!tool) {
      throw new NotFoundException(`Tool '${baseToolName}' not found`);
    }

    if (!tool.is_enabled) {
      throw new Error(`Tool '${toolName}' is disabled`);
    }

    // Find the action
    const resolvedActionName =
      actionNameFromCall ?? tool.actions?.[0]?.name ?? 'default';

    const action = tool.actions?.find((a) => a.name === resolvedActionName);

    this.logger.log(
      `Executing tool: ${baseToolName} action: ${resolvedActionName}`,
    );

    const startTime = Date.now();
    try {
      // Get or create executor
      const executor = this.getExecutor(tool);

      // Build enriched params with action info
      const enrichedParams = {
        ...params,
        _action: resolvedActionName,
        _toolId: tool.id,
        _workspaceId: context.workspaceId,
        _actionConfig: action?.executor_config || {},
      };

      // Execute the tool
      const result = await executor.execute(enrichedParams, context);

      // Log successful execution
      await this.logExecution({
        tool_id: tool.id,
        action_name: resolvedActionName,
        chat_session_id: context.sessionId || null,
        input_params: params,
        output_result: result,
        status: 'success',
        execution_time_ms: Date.now() - startTime,
      });

      this.logger.log(
        `Tool ${toolName} executed successfully in ${Date.now() - startTime}ms`,
      );

      return result;
    } catch (error: any) {
      // Log failed execution
      await this.logExecution({
        tool_id: tool.id,
        action_name: resolvedActionName,
        chat_session_id: context.sessionId || null,
        input_params: params,
        output_result: null,
        status: 'error',
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
      });

      this.logger.error(`Tool ${toolName} execution failed:`, error);
      throw error;
    }
  }

  /**
   * Get or create executor for a tool
   */
  private getExecutor(tool: Tool): BaseToolExecutor {
    const cacheKey = `${tool.executor_type}:${tool.id}`;

    if (!this.executors.has(cacheKey)) {
      let executor: BaseToolExecutor;

      switch (tool.executor_type) {
        case 'rag':
          executor = new RagExecutor(tool.executor_config, this.ragService);
          break;

        case 'function':
          executor = new FunctionExecutor(tool.executor_config);
          break;

        // Generic API executor handles all API types
        case 'generic_api':
        case 'http_api':
        case 'oauth_api':
          executor = new GenericApiExecutor(
            tool.executor_config,
            this.oauthService,
          );
          break;

        default:
          throw new Error(`Unsupported executor type: ${tool.executor_type}`);
      }

      this.executors.set(cacheKey, executor);
    }

    return this.executors.get(cacheKey)!;
  }

  /**
   * Clear executor cache (useful when tool config changes)
   */
  clearExecutorCache(toolId?: string): void {
    if (toolId) {
      // Clear specific tool's executor
      for (const key of this.executors.keys()) {
        if (key.endsWith(`:${toolId}`)) {
          this.executors.delete(key);
        }
      }
    } else {
      // Clear all
      this.executors.clear();
    }
  }

  /**
   * Log tool execution
   */
  private async logExecution(data: {
    tool_id: string;
    action_name: string;
    chat_session_id: string | null;
    input_params: Record<string, any>;
    output_result: Record<string, any> | null;
    status: 'success' | 'error';
    error_message?: string;
    execution_time_ms: number;
  }): Promise<void> {
    try {
      const log = this.logRepo.create(data);
      await this.logRepo.save(log);
    } catch (error) {
      this.logger.error('Failed to log tool execution:', error);
      // Don't throw - logging failure shouldn't break tool execution
    }
  }
}
