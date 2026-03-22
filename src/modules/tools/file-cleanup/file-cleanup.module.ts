import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FileCleanupProducer } from './file-cleanup.producer';
import { FileCleanupProcessor } from './file-cleanup.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'file-cleanup',
    }),
  ],
  providers: [FileCleanupProducer, FileCleanupProcessor],
  exports: [FileCleanupProducer],
})
export class FileCleanupModule {}
