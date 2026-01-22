import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Tool } from './tool.entity';

/**
 * Stores OAuth credentials for each user per tool per workspace.
 * Example: User A connects their Gmail in Workspace X
 */
@Entity({ name: 'user_tool_credentials' })
@Unique(['user_id', 'workspace_id', 'tool_id'])
export class UserToolCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'uuid' })
  tool_id: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string; // 'google', 'microsoft', 'slack', etc.

  // Encrypted tokens
  @Column({ type: 'text' })
  access_token: string;

  @Column({ type: 'text', nullable: true })
  refresh_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  // Scopes granted by user
  @Column({ type: 'simple-array', nullable: true })
  scopes: string[] | null;

  // User info from OAuth provider (email, name, avatar, etc.)
  @Column({ type: 'jsonb', nullable: true })
  profile: {
    email?: string;
    name?: string;
    picture?: string;
    [key: string]: any;
  } | null;

  // Additional metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  connected_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => Tool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool: Tool;
}
