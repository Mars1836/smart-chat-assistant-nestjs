import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'group_members' })
export class GroupMember {
  @PrimaryColumn('uuid')
  group_id: string;

  @PrimaryColumn('uuid')
  user_id: string;

  @ManyToOne(() => Group, { nullable: false })
  group: Group;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column({ type: 'varchar', length: 10 })
  role: 'member' | 'manager';

  @Column({ type: 'timestamp' })
  joined_at: Date;
}
