import { User } from '../../users/entities/user.entity';
export declare class Document {
    id: string;
    user: User;
    file_name: string;
    file_url: string;
    type: string;
    vector_id: string | null;
    uploaded_at: Date;
}
