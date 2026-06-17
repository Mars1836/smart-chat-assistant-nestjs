import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class FileCleanupProducer {
  private readonly logger = new Logger(FileCleanupProducer.name);

  constructor(
    @InjectQueue('file-cleanup') private readonly cleanupQueue: Queue,
  ) {}

  /**
   * Schedule a file for deletion after a delay
   * @param filePath Absolute path of the file to delete
   * @param delayMs Delay in milliseconds
   */
  async scheduleCleanup(filePath: string, delayMs: number): Promise<void> {
    try {
      await this.cleanupQueue.add(
        'delete-file',
        { filePath },
        {
          delay: delayMs,
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for inspection
          attempts: 3, // Retry a few times if file is locked
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
      this.logger.log(`Scheduled cleanup for ${filePath} in ${delayMs}ms`);
    } catch (error) {
      this.logger.error(`Failed to schedule cleanup for ${filePath}`, error);
    }
  }
}
