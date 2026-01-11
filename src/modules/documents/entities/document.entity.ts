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

  // Relations
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
