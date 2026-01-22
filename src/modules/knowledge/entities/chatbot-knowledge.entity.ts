import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  CreateDateColumn,
  PrimaryColumn,
} from 'typeorm';
import { Chatbot } from '../../chatbots/entities/chatbot.entity';
import { Knowledge } from './knowledge.entity';

/**
 * Links a Chatbot to Knowledge bases it can use for RAG
 * When chatbot receives a message, it will search across all linked knowledge bases
 */
@Entity({ name: 'chatbot_knowledge' })
export class ChatbotKnowledge {
  @PrimaryColumn({ type: 'uuid' })
  chatbot_id: string;

  @PrimaryColumn({ type: 'uuid' })
  knowledge_id: string;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number; // Higher priority = searched first

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // Relations
  @ManyToOne(() => Chatbot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;

  @ManyToOne(() => Knowledge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_id' })
  knowledge: Knowledge;
}
