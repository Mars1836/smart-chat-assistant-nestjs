import { User } from '../../users/entities/user.entity';
import { Group } from '../../groups/entities/group.entity';
export declare class Conversation {
    id: string;
    user: User;
    group: Group | null;
    mode: 'personal' | 'group';
    started_at: Date;
    ended_at: Date | null;
}
