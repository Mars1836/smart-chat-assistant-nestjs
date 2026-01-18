import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentsService } from './documents.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), RagModule],
  providers: [DocumentsService],
  exports: [TypeOrmModule, DocumentsService],
})
export class DocumentsModule {}
