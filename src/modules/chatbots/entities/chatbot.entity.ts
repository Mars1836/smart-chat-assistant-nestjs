import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { ChatbotTool } from '../../tools/entities/chatbot-tool.entity';

@Entity({ name: 'chatbots' })
export class Chatbot extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, default: 'vi' })
  language: string;

  @Column({ type: 'text', nullable: true })
  personality: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  greeting_message: string | null;

  @Column({ type: 'text', nullable: true })
  fallback_message: string | null;

  @Column({ type: 'float', default: 0.7 })
  confidence_threshold: number;

  @Column({ type: 'integer', default: 5 })
  max_context_turns: number;

  @Column({ type: 'boolean', default: true })
  enable_learning: boolean;

  @Column({ type: 'varchar', length: 20, default: 'openai' })
  llm_provider: string;

  @Column({ type: 'varchar', length: 50, default: 'gemini-2.0-flash-lite' })
  llm_model: string;

  @Column({ type: 'float', default: 0.7 })
  temperature: number;

  @Column({ type: 'integer', default: 1000 })
  max_tokens: number;

  // Widget configuration for embeddable chat widget
  // Example shape:
  // {
  //   enabled: true,
  //   position: 'bottom-right',
  //   primaryColor: '#4f46e5',
  //   title: 'Hỗ trợ khách hàng',
  //   greeting: 'Xin chào...',
  //   allowedOrigins: ['https://example.com'],
  //   lang: 'vi'
  // }
  @Column({ type: 'jsonb', nullable: true })
  widget_config: Record<string, any> | null;

  // Relations
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @OneToMany(() => ChatbotTool, (chatbotTool) => chatbotTool.chatbot)
  tools: ChatbotTool[];
}
