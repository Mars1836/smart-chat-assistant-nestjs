import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Chatbot } from '../../chatbots/entities/chatbot.entity';
import { Tool } from './tool.entity';

@Entity({ name: 'chatbot_tools' })
export class ChatbotTool extends BaseEntity {
  @Column({ type: 'uuid' })
  chatbot_id: string;

  @Column({ type: 'uuid' })
  tool_id: string;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config_override: Record<string, any> | null;

  // Store user authentication tokens (OAuth tokens, API keys, etc.)
  // Format: { user_id: { access_token, refresh_token, expires_at }, ... }
  @Column({ type: 'jsonb', nullable: true })
  user_auth_tokens: Record<string, any> | null;

  // Relations
  @ManyToOne(() => Chatbot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;
}
