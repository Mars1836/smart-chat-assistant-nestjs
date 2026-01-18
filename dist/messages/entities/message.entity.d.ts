import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { Intent } from '../../intents/entities/intent.entity';
export declare class Message {
    id: string;
    conversation: Conversation;
    sender_type: 'user' | 'bot';
    sender: User | null;
    content: string;
    intent: Intent | null;
    created_at: Date;
}
