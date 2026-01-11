import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Chatbot } from '../../chatbots/entities/chatbot.entity';

@Entity({ name: 'conversations' })
export class Conversation extends BaseEntity {
  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  chatbot_id: string;

  @CreateDateColumn({ type: 'timestamp' })
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  ended_at: Date | null;

  // Relations
  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Chatbot, { nullable: false })
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;
}
