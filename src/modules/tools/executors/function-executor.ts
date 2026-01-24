import { Injectable } from '@nestjs/common';
import { BaseToolExecutor, ExecutionContext } from './base-executor';

@Injectable()
export class FunctionExecutor extends BaseToolExecutor {
  private readonly functions: Record<string, (params: any, context: ExecutionContext) => any> = {
    get_current_time: () => ({
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      formatted: new Date().toLocaleString('vi-VN', {
        dateStyle: 'full',
        timeStyle: 'long',
      }),
    }),
  };

  async execute(
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<any> {
    // 1. Try to get function name from tool config
    // 2. If not found, try to get from _action param (injected by ToolExecutorService)
    const functionName = (this.config.function as string) || (params._action as string);

    if (!functionName || !this.functions[functionName]) {
      throw new Error(`Function '${functionName}' not found`);
    }

    return this.functions[functionName](params, context);
  }
}
