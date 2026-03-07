import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SystemRole } from '../../system-roles/entities/system-role.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  google_id: string | null;

  @Column({ type: 'text', nullable: true })
  avatar_url: string | null;

  @Column({ type: 'varchar', length: 10, default: 'vi' })
  language: string;

  @Column({ type: 'uuid', nullable: true })
  system_role_id: string | null;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  // Relations
  @ManyToOne(() => SystemRole, (role) => role.users, { nullable: true })
  @JoinColumn({ name: 'system_role_id' })
  systemRole: SystemRole | null;
}
