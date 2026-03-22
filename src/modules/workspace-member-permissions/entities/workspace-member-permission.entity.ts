import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WorkspaceMember } from '../../workspace-members/entities/workspace-member.entity';
import { WorkspacePermission } from '../../workspace-permissions/entities/workspace-permission.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'workspace_member_permissions' })
export class WorkspaceMemberPermission extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_member_id: string;

  @Column({ type: 'uuid' })
  permission_id: string;

  @Column({ type: 'varchar', length: 10 })
  grant_type: 'grant' | 'revoke';

  @Column({ type: 'uuid' })
  granted_by: string;

  @CreateDateColumn({ type: 'timestamp' })
  granted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  // Relations
  @ManyToOne(() => WorkspaceMember, (member) => member.customPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspace_member_id' })
  workspaceMember: WorkspaceMember;

  @ManyToOne(() => WorkspacePermission, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission: WorkspacePermission;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'granted_by' })
  grantedByUser: User;
}
