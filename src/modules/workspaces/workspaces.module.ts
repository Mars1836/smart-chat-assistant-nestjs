import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceEncryptionKey } from './entities/workspace-encryption-key.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import {
  WorkspacesController,
  WorkspacesAdminController,
} from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceEncryptionService } from './workspace-encryption.service';
import { UsersModule } from '../users/users.module';
import { SystemAdminGuard } from '../users/guards/system-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceEncryptionKey,
      Chatbot,
      WorkspaceMember,
      WorkspaceRole,
    ]),
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'your-secret-key',
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN') ?? '1h',
        } as any,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [WorkspacesController, WorkspacesAdminController],
  providers: [WorkspacesService, WorkspaceEncryptionService, SystemAdminGuard],
  exports: [TypeOrmModule, WorkspacesService, WorkspaceEncryptionService],
})
export class WorkspacesModule {}
