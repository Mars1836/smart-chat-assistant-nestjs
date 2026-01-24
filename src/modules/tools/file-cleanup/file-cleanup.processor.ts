import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs';

@Processor('file-cleanup')
export class FileCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(FileCleanupProcessor.name);

  async process(job: Job<{ filePath: string }>): Promise<void> {
    const { filePath } = job.data;
    this.logger.debug(`Processing file cleanup: ${filePath}`);

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Deleted file: ${filePath}`);
      } else {
        this.logger.warn(`File not found during cleanup: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, error);
      throw error; // Let BullMQ retry
    }
  }
}
