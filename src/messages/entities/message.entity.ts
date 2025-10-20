import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { Intent } from '../../intents/entities/intent.entity';

@Entity({ name: 'messages' })
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, { nullable: false })
  conversation: Conversation;

  @Column({ type: 'varchar', length: 10 })
  sender_type: 'user' | 'bot';

  @ManyToOne(() => User, { nullable: true })
  sender: User | null;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => Intent, { nullable: true })
  intent: Intent | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
