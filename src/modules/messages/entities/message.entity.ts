import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { MessageAttachment } from './message-attachment.entity';

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

  @Column({ type: 'uuid', nullable: true })
  intent_id: string | null;

  @OneToMany(() => MessageAttachment, (attachment) => attachment.message, {
    cascade: true,
  })
  attachments: MessageAttachment[];

  /** Token usage cho tin nhắn bot (input_tokens, output_tokens). Chỉ có khi sender_type = bot. */
  @Column({ type: 'jsonb', nullable: true })
  token_usage: { input_tokens: number; output_tokens: number } | null;

  /** Tools và kết quả mà chatbot đã gọi cho tin nhắn này. Chỉ có khi sender_type = bot. */
  @Column({ type: 'jsonb', nullable: true })
  tools_used: { tool_name: string; args: Record<string, any>; result: any }[] | null;
}
