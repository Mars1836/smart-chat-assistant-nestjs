import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Document } from '../../documents/entities/document.entity';

@Entity({ name: 'document_vectors' })
export class DocumentVector extends BaseEntity {
  @Column({ type: 'uuid' })
  document_id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Note: Embeddings are stored in Qdrant vector database.
  // This entity only stores metadata for reference.
  // The actual embedding vector is stored in Qdrant with point_id = this.id

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;
}
