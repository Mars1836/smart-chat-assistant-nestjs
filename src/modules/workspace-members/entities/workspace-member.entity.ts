import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { WorkspaceRole } from '../../workspace-roles/entities/workspace-role.entity';
import { WorkspaceMemberPermission } from '../../workspace-member-permissions/entities/workspace-member-permission.entity';

@Entity({ name: 'workspace_members' })
export class WorkspaceMember extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  workspace_role_id: string;

  @CreateDateColumn({ type: 'timestamp' })
  joined_at: Date;

  @Column({ type: 'uuid', nullable: true })
  invited_by: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // Relations
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => WorkspaceRole, (role) => role.workspaceMembers, {
    nullable: false,
  })
  @JoinColumn({ name: 'workspace_role_id' })
  workspaceRole: WorkspaceRole;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'invited_by' })
  invitedByUser: User | null;

  @OneToMany(() => WorkspaceMemberPermission, (perm) => perm.workspaceMember)
  customPermissions: WorkspaceMemberPermission[];
}
