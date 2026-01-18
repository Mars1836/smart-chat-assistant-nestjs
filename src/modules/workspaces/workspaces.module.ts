import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Workspace } from './entities/workspace.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, Chatbot, WorkspaceMember, WorkspaceRole]),
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
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [TypeOrmModule, WorkspacesService],
})
export class WorkspacesModule {}
