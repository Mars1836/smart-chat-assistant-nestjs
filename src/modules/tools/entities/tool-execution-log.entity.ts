import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tool } from './tool.entity';

@Entity({ name: 'tool_execution_logs' })
export class ToolExecutionLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  chat_session_id: string | null;

  @Column({ type: 'uuid' })
  tool_id: string;

  // Which action was executed (e.g., "list", "send", "reply" for Gmail tool)
  @Column({ type: 'varchar', length: 100, default: 'default' })
  action_name: string;

  @Column({ type: 'jsonb' })
  input_params: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  output_result: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: 'success' | 'error';

  @Column('text', { nullable: true })
  error_message: string | null;

  @Column({ type: 'int', nullable: true })
  execution_time_ms: number | null;

  @CreateDateColumn()
  executed_at: Date;

  // Relations
  @ManyToOne(() => Tool)
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;
}
