export declare class User {
    id: string;
    name: string;
    email: string;
    google_id: string | null;
    avatar_url: string | null;
    language: string;
    role: 'user' | 'admin';
    created_at: Date;
    updated_at: Date;
}
