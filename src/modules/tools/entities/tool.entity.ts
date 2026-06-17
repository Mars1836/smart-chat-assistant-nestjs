import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ToolAction } from './tool-action.entity';
import { ChatbotTool } from './chatbot-tool.entity';

@Entity({ name: 'tools' })
export class Tool extends BaseEntity {
  @Column({ type: 'varchar', unique: true, length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  display_name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'custom' })
  category: 'builtin' | 'custom' | 'community';

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @Column({ type: 'boolean', default: true })
  is_public: boolean;

  // Executor type for this tool
  // 'generic_api' is the new unified type for all API calls (REST, OAuth, etc.)
  // 'http_api' and 'oauth_api' kept for backwards compatibility
  @Column({ type: 'varchar', length: 50 })
  executor_type:
    | 'generic_api'
    | 'http_api'
    | 'function'
    | 'rag'
    | 'oauth_api'
    | 'database';

  // Default execution config (can be overridden at action level)
  @Column({ type: 'jsonb', default: {} })
  executor_config: Record<string, any>;

  // Authentication configuration (OAuth, API keys, etc.)
  @Column({ type: 'jsonb', nullable: true })
  auth_config: {
    type?: 'oauth2' | 'api_key' | 'basic' | 'none';
    oauth?: {
      authorization_url?: string;
      token_url?: string;
      scopes?: string[];
      client_id?: string;
      client_secret?: string;
    };
    api_key?: {
      header_name?: string;
    };
  } | null;

  // Icon URL for display
  @Column({ type: 'varchar', length: 500, nullable: true })
  icon_url: string | null;

  // Relations
  @OneToMany(() => ToolAction, (action) => action.tool, {
    cascade: true,
    eager: true,
  })
  actions: ToolAction[];

  @OneToMany(() => ChatbotTool, (chatbotTool) => chatbotTool.tool)
  chatbot_tools: ChatbotTool[];
}
