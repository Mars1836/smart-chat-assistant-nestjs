import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Chatbot } from '../../chatbots/entities/chatbot.entity';

@Entity({ name: 'custom_responses' })
export class CustomResponse extends BaseEntity {
  @Column({ type: 'uuid' })
  chatbot_id: string;

  @Column({ type: 'varchar', length: 100 })
  intent_name: string;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  response_type: string;

  @Column({ type: 'jsonb' })
  content: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any> | null;

  @Column({ type: 'integer', default: 1 })
  priority: number;

  // Relations
  @ManyToOne(() => Chatbot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;
}
