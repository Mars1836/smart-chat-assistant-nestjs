import { Injectable } from '@nestjs/common';
import { BaseToolExecutor, ExecutionContext } from './base-executor';

@Injectable()
export class FunctionExecutor extends BaseToolExecutor {
  private readonly functions: Record<string, (params: any, context: ExecutionContext) => any> = {
    get_current_time: (params: any) => {
      const timezone = params?.timezone || 'Asia/Ho_Chi_Minh';
      const now = new Date();
      
      // Format options for specific parts
      const options: Intl.DateTimeFormatOptions = { 
        timeZone: timezone,
        hour12: false 
      };

      const formatter = new Intl.DateTimeFormat('vi-VN', {
        ...options,
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const parts = formatter.formatToParts(now);
      const part = (type: string) => parts.find(p => p.type === type)?.value;

      return {
        timestamp: now.toISOString(),
        timezone: timezone,
        weekday: part('weekday'),
        day: part('day'),
        month: part('month'),
        year: part('year'),
        hour: part('hour'),
        minute: part('minute'),
        second: part('second'),
        formatted: formatter.format(now),
      };
    },
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
