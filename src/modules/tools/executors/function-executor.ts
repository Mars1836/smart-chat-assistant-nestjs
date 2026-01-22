import { Injectable } from '@nestjs/common';
import { BaseToolExecutor, ExecutionContext } from './base-executor';

@Injectable()
export class FunctionExecutor extends BaseToolExecutor {
  private readonly functions: Record<string, (params: any, context: ExecutionContext) => any> = {
    getCurrentTime: () => ({
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
    const functionName = this.config.function as string;

    if (!this.functions[functionName]) {
      throw new Error(`Function '${functionName}' not found`);
    }

    return this.functions[functionName](params, context);
  }
}
