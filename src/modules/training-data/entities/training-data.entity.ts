import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Chatbot } from '../../chatbots/entities/chatbot.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'training_data' })
export class TrainingData extends BaseEntity {
  @Column({ type: 'uuid' })
  chatbot_id: string;

  @Column({ type: 'varchar', length: 20 })
  source_type: string;

  @Column({ type: 'text' })
  input_text: string;

  @Column({ type: 'varchar', length: 100 })
  intent: string;

  @Column({ type: 'jsonb', nullable: true })
  entities: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  correct_response: string | null;

  @Column({ type: 'boolean', default: false })
  is_validated: boolean;

  @Column({ type: 'uuid', nullable: true })
  validated_by: string | null;

  // Relations
  @ManyToOne(() => Chatbot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'validated_by' })
  validator: User | null;
}
