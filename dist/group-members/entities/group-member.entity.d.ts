import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';
export declare class GroupMember {
    group_id: string;
    user_id: string;
    group: Group;
    user: User;
    role: 'member' | 'manager';
    joined_at: Date;
}
