import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'system_roles' })
export class SystemRole extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Relations
  @OneToMany(() => User, (user) => user.systemRole)
  users: User[];
}
