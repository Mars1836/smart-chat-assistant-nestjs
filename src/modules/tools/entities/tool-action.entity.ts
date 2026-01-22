import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tool } from './tool.entity';

@Entity({ name: 'tool_actions' })
export class ToolAction extends BaseEntity {
  @Column({ type: 'uuid' })
  tool_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g., 'send_email', 'list_emails'

  @Column({ type: 'varchar', length: 255 })
  display_name: string; // e.g., 'Send Email', 'List Emails'

  @Column({ type: 'text' })
  description: string;

  // JSON Schema for parameters
  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  // Execution config specific to this action (overrides tool's executor_config)
  @Column({ type: 'jsonb', nullable: true })
  executor_config: Record<string, any> | null;

  // Order for display purposes
  @Column({ type: 'int', default: 0 })
  sort_order: number;

  // Relations
  @ManyToOne(() => Tool, (tool) => tool.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;
}
