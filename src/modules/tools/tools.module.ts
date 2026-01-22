import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Tool } from './entities/tool.entity';
import { ToolAction } from './entities/tool-action.entity';
import { ChatbotTool } from './entities/chatbot-tool.entity';
import { ChatbotToolAction } from './entities/chatbot-tool-action.entity';
import { WorkspaceTool } from './entities/workspace-tool.entity';
import { UserToolCredential } from './entities/user-tool-credential.entity';
import { ToolExecutionLog } from './entities/tool-execution-log.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { ToolRegistryService } from './tool-registry.service';
import { ToolExecutorService } from './tool-executor.service';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { ChatbotToolsController } from './chatbot-tools.controller';
import { WorkspaceToolsController } from './workspace-tools.controller';
import { OAuthController } from './oauth.controller';
import { WorkspaceToolsService } from './workspace-tools.service';
import { OAuthService } from './oauth.service';
import { RagModule } from '../rag/rag.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tool,
      ToolAction,
      ChatbotTool,
      ChatbotToolAction,
      WorkspaceTool,
      UserToolCredential,
      ToolExecutionLog,
      Chatbot,
      Workspace,
    ]),
    ConfigModule, // For OAuthService to read env vars
    RagModule, // Import to use RagService
    AuthModule, // Import to provide JwtService & JwtAuthGuard in this module context
  ],
  controllers: [
    ToolsController,
    ChatbotToolsController,
    WorkspaceToolsController,
    OAuthController,
  ],
  providers: [
    ToolRegistryService,
    ToolExecutorService,
    ToolsService,
    WorkspaceToolsService,
    OAuthService,
  ],
  exports: [
    ToolRegistryService,
    ToolExecutorService,
    ToolsService,
    WorkspaceToolsService,
    OAuthService,
  ],
})
export class ToolsModule {}
