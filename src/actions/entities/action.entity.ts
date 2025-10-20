import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Message } from '../../messages/entities/message.entity';

@Entity({ name: 'actions' })
export class Action {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, { nullable: false })
  message: Message;

  @Column({ type: 'varchar', length: 20 })
  type: 'send_email' | 'create_event' | 'read_document' | 'payment';

  @Column({ type: 'varchar', length: 10 })
  status: 'pending' | 'success' | 'failed';

  @Column({ type: 'jsonb' })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  executed_at: Date;
}
