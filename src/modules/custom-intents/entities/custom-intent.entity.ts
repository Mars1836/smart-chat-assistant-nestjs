import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Chatbot } from '../../chatbots/entities/chatbot.entity';

@Entity({ name: 'custom_intents' })
export class CustomIntent extends BaseEntity {
  @Column({ type: 'uuid' })
  chatbot_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  training_examples: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  required_entities: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  action_type: string | null;

  @Column({ type: 'jsonb', nullable: true })
  action_config: Record<string, any> | null;

  // Relations
  @ManyToOne(() => Chatbot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;
}

