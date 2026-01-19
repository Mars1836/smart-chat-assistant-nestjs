import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

@Entity({ name: 'documents' })
export class Document extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  file_name: string;

  @Column({ type: 'text' })
  file_url: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'bigint', nullable: true })
  size: number | null;

  @Column({ type: 'uuid', nullable: true })
  vector_id: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  uploaded_at: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'indexed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'int', default: 0 })
  processing_progress: number;

  @Column({ type: 'varchar', nullable: true })
  processing_message: string;

  @Column({ type: 'int', default: 0 })
  chunk_count: number;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  // Relations
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
