import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WorkspaceMember } from '../../workspace-members/entities/workspace-member.entity';

@Entity({ name: 'workspace_roles' })
export class WorkspaceRole extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer' })
  level: number;

  // Relations
  @OneToMany(() => WorkspaceMember, (member) => member.workspaceRole)
  workspaceMembers: WorkspaceMember[];
}
