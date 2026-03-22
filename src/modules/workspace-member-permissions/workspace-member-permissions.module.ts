import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkspaceMemberPermission } from './entities/workspace-member-permission.entity';
import { WorkspaceMemberPermissionsService } from './workspace-member-permissions.service';
import { WorkspaceMemberPermissionsController } from './workspace-member-permissions.controller';
import { WorkspacePermission } from '../workspace-permissions/entities/workspace-permission.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';

import { WorkspacePermissionsModule } from '../workspace-permissions/workspace-permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceMemberPermission,
      WorkspacePermission,
      WorkspaceMember,
    ]),
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
    WorkspacePermissionsModule,
  ],
  controllers: [WorkspaceMemberPermissionsController],
  providers: [WorkspaceMemberPermissionsService],
  exports: [TypeOrmModule, WorkspaceMemberPermissionsService],
})
export class WorkspaceMemberPermissionsModule {}
