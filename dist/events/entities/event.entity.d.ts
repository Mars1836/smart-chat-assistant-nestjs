import { User } from '../../users/entities/user.entity';
export declare class Event {
    id: string;
    user: User;
    google_event_id: string | null;
    title: string;
    start_time: Date;
    end_time: Date;
    location: string | null;
    description: string | null;
    created_at: Date;
}
