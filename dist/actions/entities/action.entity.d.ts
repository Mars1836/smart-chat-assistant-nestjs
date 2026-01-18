import { Message } from '../../messages/entities/message.entity';
export declare class Action {
    id: string;
    message: Message;
    type: 'send_email' | 'create_event' | 'read_document' | 'payment';
    status: 'pending' | 'success' | 'failed';
    metadata: Record<string, unknown>;
    executed_at: Date;
}
