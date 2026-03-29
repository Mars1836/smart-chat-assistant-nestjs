import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Tool } from './tool.entity';

@Entity({ name: 'workspace_tools' })
@Unique(['workspace_id', 'tool_id'])
export class WorkspaceTool extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'uuid' })
  tool_id: string;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config_override: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  added_by: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;
}
