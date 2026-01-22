import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Chatbot } from '../../chatbots/entities/chatbot.entity';
import { Tool } from './tool.entity';
import { ToolAction } from './tool-action.entity';

@Entity({ name: 'chatbot_tool_actions' })
@Unique(['chatbot_id', 'tool_action_id'])
export class ChatbotToolAction extends BaseEntity {
  @Column({ type: 'uuid' })
  chatbot_id: string;

  @Column({ type: 'uuid' })
  tool_id: string;

  @Column({ type: 'uuid' })
  tool_action_id: string;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  // Override action's parameters/config for this chatbot
  @Column({ type: 'jsonb', nullable: true })
  config_override: Record<string, any> | null;

  // Relations
  @ManyToOne(() => Chatbot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;

  @ManyToOne(() => ToolAction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_action_id' })
  tool_action: ToolAction;
}
