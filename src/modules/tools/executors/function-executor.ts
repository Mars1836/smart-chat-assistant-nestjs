import { Injectable } from '@nestjs/common';
import { BaseToolExecutor, ExecutionContext } from './base-executor';
import { FileCleanupProducer } from '../file-cleanup/file-cleanup.producer';

@Injectable()
export class FunctionExecutor extends BaseToolExecutor {
  constructor(
    config: Record<string, any>,
    private readonly fileCleanupProducer?: FileCleanupProducer,
  ) {
    super(config);
  }

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

    generate_excel: async (params: any) => {
      // Lazy import to avoid load issues if not installed (though we installed it)
      const ExcelJS = require('exceljs');
      const fs = require('fs');
      const path = require('path');

      const { filename, columns, data } = params;
      const safeFilename = (filename || 'export').replace(/[^a-zA-Z0-9-_]/g, '') + '_' + Date.now() + '.xlsx';
      
      // Use temp directory
      const tempDir = path.join(process.cwd(), 'uploads', 'temp');
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // NOTE: Lazy cleanup removed in favor of BullMQ

      const filePath = path.join(tempDir, safeFilename);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet 1');

      if (columns && Array.isArray(columns)) {
        worksheet.columns = columns.map((col: any) => ({
          header: col.header || col.key,
          key: col.key,
          width: col.width || 20,
        }));
      } else if (data && data.length > 0) {
        // Auto-detect columns from first row if not provided
        const keys = Object.keys(data[0]);
        worksheet.columns = keys.map(key => ({ header: key, key, width: 20 }));
      }

      if (data && Array.isArray(data)) {
        worksheet.addRows(data);
      }

      await workbook.xlsx.writeFile(filePath);

      // Schedule cleanup via BullMQ (5 minutes delay)
      if (this.fileCleanupProducer) {
        // 5 minutes = 5 * 60 * 1000 ms = 300000 ms
        await this.fileCleanupProducer.scheduleCleanup(filePath, 5 * 60 * 1000);
      } else {
        console.warn('FileCleanupProducer not available, file will NOT be auto-cleaned up via Queue');
      }

      return {
        success: true,
        filename: safeFilename,
        path: filePath,
        url: `/uploads/temp/${safeFilename}`, // Suggesting a URL pattern
        message: `Excel file created: ${safeFilename} (will be deleted in 5 minutes)`
      };
    },

  };

  async execute(
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<any> {
    // 1. Try to get function name from action config (params._actionConfig)
    // 2. Try to get function name from tool config (this.config)
    // 3. If not found, fall back to action name (params._action)
    const functionName = 
      (params._actionConfig?.function as string) || 
      (this.config.function as string) || 
      (params._action as string);

    if (!functionName || !this.functions[functionName]) {
      throw new Error(`Function '${functionName}' not found`);
    }

    return this.functions[functionName](params, context);
  }
}
