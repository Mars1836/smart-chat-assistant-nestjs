import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { Document } from '../../documents/entities/document.entity';

export type KnowledgeStatus = 'active' | 'indexing' | 'error';

@Entity({ name: 'knowledge_bases' })
export class Knowledge extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'indexing', 'error'],
    default: 'active',
  })
  status: KnowledgeStatus;

  @Column({ type: 'int', default: 0 })
  document_count: number;

  @Column({ type: 'int', default: 0 })
  total_chunks: number;

  @Column({ type: 'bigint', default: 0 })
  total_size: number;

  // Relations
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;

  @OneToMany(() => Document, (doc) => doc.knowledge, { cascade: true })
  documents: Document[];
}
