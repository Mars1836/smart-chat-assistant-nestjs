import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

@Entity({ name: 'workspace_wallets' })
export class WorkspaceWallet extends BaseEntity {
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  balance: string;

  @Column({ type: 'varchar', length: 10, default: 'CREDITS' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'suspended';
}

