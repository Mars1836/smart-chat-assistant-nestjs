import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { WorkspaceRole } from '../../workspace-roles/entities/workspace-role.entity';
import { WorkspacePermission } from '../../workspace-permissions/entities/workspace-permission.entity';

@Entity({ name: 'workspace_role_permissions' })
export class WorkspaceRolePermission {
  @PrimaryColumn({ type: 'uuid' })
  workspace_role_id: string;

  @PrimaryColumn({ type: 'uuid' })
  permission_id: string;

  @ManyToOne(() => WorkspaceRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_role_id' })
  workspaceRole: WorkspaceRole;

  @ManyToOne(() => WorkspacePermission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: WorkspacePermission;
}
