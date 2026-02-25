import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

@Entity({ name: 'wallet_transactions' })
export class WalletTransaction extends BaseEntity {
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  workspace_id: string;

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

