import { Global, Module } from '@nestjs/common';
import { DocumentStorageService } from './document-storage.service';

@Global()
@Module({
  providers: [DocumentStorageService],
  exports: [DocumentStorageService],
})
export class StorageModule {}
