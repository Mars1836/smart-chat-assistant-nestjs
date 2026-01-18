import { User } from '../../users/entities/user.entity';
export declare class Payment {
    id: string;
    user: User;
    amount: string;
    description: string | null;
    provider: 'zalopay' | 'momo' | 'bank';
    transaction_id: string;
    status: 'pending' | 'success' | 'failed';
    created_at: Date;
}
