import { Injectable } from '@nestjs/common';
import { BaseToolExecutor, ExecutionContext } from './base-executor';
import { RagService } from '../../rag/rag.service';

@Injectable()
export class RagExecutor extends BaseToolExecutor {
  constructor(
    config: Record<string, any>,
    private readonly ragService: RagService,
  ) {
    super(config);
  }

  async execute(
    params: { query: string; limit?: number; knowledgeIds?: string[] },
    context: ExecutionContext,
  ): Promise<any> {
    const { query, limit = 5, knowledgeIds } = params;

    // Use RAG service with knowledge filter
    const results = await this.ragService.search(
      query,
      {
        workspaceId: context.workspaceId,
        knowledgeIds: knowledgeIds,
      },
      limit,
    );

    return {
      query,
      results,
      count: results.length,
    };
  }
}
