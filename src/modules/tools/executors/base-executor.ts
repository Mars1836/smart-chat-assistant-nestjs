export interface ExecutionContext {
  userId: string;
  workspaceId: string;
  chatbotId: string;
  sessionId?: string;
}

export abstract class BaseToolExecutor {
  constructor(protected config: Record<string, any>) {}

  abstract execute(
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<any>;
}
