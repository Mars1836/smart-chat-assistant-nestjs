import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { Intent } from '../../intents/entities/intent.entity';

@Entity({ name: 'messages' })
export class Message extends BaseEntity {
  @ManyToOne(() => Conversation, { nullable: false, onDelete: 'CASCADE' })
  conversation: Conversation;

  @Column({ type: 'varchar', length: 10 })
  sender_type: 'user' | 'bot';

  @ManyToOne(() => User, { nullable: true })
  sender: User | null;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => Intent, { nullable: true })
  intent: Intent | null;
}
