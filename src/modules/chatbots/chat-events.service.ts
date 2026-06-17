import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';

export type ChatProgressEvent =
  | {
      type:
        | 'chat_started'
        | 'planning'
        | 'routing'
        | 'assistant_responding'
        | 'completed';
      conversation_id: string;
      chatbot_id: string;
      timestamp: string;
      message?: string;
      step?: number;
    }
  | {
      type: 'tool_started' | 'tool_succeeded' | 'tool_failed';
      conversation_id: string;
      chatbot_id: string;
      timestamp: string;
      tool_name: string;
      step?: number;
      args?: Record<string, any>;
      result?: any;
      error?: string;
      message?: string;
    }
  | {
      type: 'failed';
      conversation_id: string;
      chatbot_id: string;
      timestamp: string;
      error: string;
      message?: string;
    };

@Injectable()
export class ChatEventsService {
  private readonly streams = new Map<string, ReplaySubject<MessageEvent>>();

  getConversationStream(conversationId: string): Observable<MessageEvent> {
    return this.getOrCreateStream(conversationId).asObservable();
  }

  emit(event: ChatProgressEvent) {
    this.getOrCreateStream(event.conversation_id).next({ data: event });
  }

  private getOrCreateStream(
    conversationId: string,
  ): ReplaySubject<MessageEvent> {
    let stream = this.streams.get(conversationId);
    if (!stream) {
      stream = new ReplaySubject<MessageEvent>(50);
      this.streams.set(conversationId, stream);
    }

    return stream;
  }
}
