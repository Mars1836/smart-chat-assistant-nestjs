import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'wallet_topup_sessions' })
export class WalletTopupSession extends BaseEntity {
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  workspace_id: string;

  /** Thành viên tạo phiên nạp (gọi API tạo VietQR). Null nếu không lưu. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  initiated_by_id: string | null;

  @Column({ type: 'varchar', length: 16, unique: true })
  code: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, nullable: true })
  amount: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'completed' | 'expired';

  @Column({ type: 'varchar', length: 20, default: 'sepay' })
  provider: string;
}
