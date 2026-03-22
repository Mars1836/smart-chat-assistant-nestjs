import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'wallet_transactions' })
export class WalletTransaction extends BaseEntity {
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  workspace_id: string;

  /** Thành viên (user) liên quan: người dùng token (usage) hoặc người tạo phiên nạp (topup). Null nếu widget/khách hoặc webhook. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: 'topup' | 'usage' | 'refund' | 'adjustment';

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  llm_provider: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  llm_model: string | null;

  @Column({ type: 'integer', nullable: true })
  input_tokens: number | null;

  @Column({ type: 'integer', nullable: true })
  output_tokens: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}

