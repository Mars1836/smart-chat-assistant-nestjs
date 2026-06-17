import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { WorkspaceRole } from '../../workspace-roles/entities/workspace-role.entity';

@Entity({ name: 'workspace_invitations' })
export class WorkspaceInvitation extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'uuid' })
  workspace_role_id: string;

  @Column({ type: 'uuid' })
  invited_by: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'accepted' | 'expired';

  // Relations
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => WorkspaceRole, { nullable: false })
  @JoinColumn({ name: 'workspace_role_id' })
  workspaceRole: WorkspaceRole;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'invited_by' })
  invitedByUser: User;
}
