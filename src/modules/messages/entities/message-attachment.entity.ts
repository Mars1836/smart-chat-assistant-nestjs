import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Message } from './message.entity';

@Entity({ name: 'message_attachments' })
export class MessageAttachment extends BaseEntity {
  @Column({ type: 'uuid' })
  message_id: string;

  @Column({ type: 'varchar', length: 50 })
  type: 'image' | 'file' | 'video' | 'audio';

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true })
  filename: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mime_type: string | null;

  @Column({ type: 'int', nullable: true })
  size: number | null; // bytes

  @ManyToOne(() => Message, (message) => message.attachments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message: Message;
}
