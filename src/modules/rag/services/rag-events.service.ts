import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface RagProgressEvent {
  documentId: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  progress: number;
  message: string;
}

@Injectable()
export class RagEventsService {
  private readonly progressSubject = new Subject<RagProgressEvent>();

  /**
   * Emit progress event
   */
  emitProgress(event: RagProgressEvent) {
    this.progressSubject.next(event);
  }

  /**
   * Subscribe to progress events for a specific document
   */
  subscribeToDocument(
    documentId: string,
  ): Observable<{ data: RagProgressEvent }> {
    return this.progressSubject.asObservable().pipe(
      filter((event) => event.documentId === documentId),
      map((event) => ({ data: event })), // Format for SSE
    );
  }
}
