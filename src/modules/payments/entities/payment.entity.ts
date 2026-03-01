import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'payments' })
export class Payment extends BaseEntity {
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 10 })
  provider: 'zalopay' | 'momo' | 'bank';

  @Column({ type: 'varchar', length: 100 })
  transaction_id: string;

  @Column({ type: 'varchar', length: 10 })
  status: 'pending' | 'success' | 'failed';
}
