import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { IntentsModule } from './modules/intents/intents.module';
import { ActionsModule } from './modules/actions/actions.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EventsModule } from './modules/events/events.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WorkspaceMembersModule } from './modules/workspace-members/workspace-members.module';
import { AuthModule } from './modules/auth/auth.module';
import { SystemRolesModule } from './modules/system-roles/system-roles.module';
import { WorkspaceRolesModule } from './modules/workspace-roles/workspace-roles.module';
import { WorkspaceMemberPermissionsModule } from './modules/workspace-member-permissions/workspace-member-permissions.module';
import { WorkspaceRolePermissionsModule } from './modules/workspace-role-permissions/workspace-role-permissions.module';
import { WorkspacePermissionsModule } from './modules/workspace-permissions/workspace-permissions.module';
import { WorkspaceInvitationsModule } from './modules/workspace-invitations/workspace-invitations.module';
import { RbacSeedModule } from './modules/rbac-seed/rbac-seed.module';
import { ChatbotsModule } from './modules/chatbots/chatbots.module';
import { CustomIntentsModule } from './modules/custom-intents/custom-intents.module';
import { CustomResponsesModule } from './modules/custom-responses/custom-responses.module';
import { TrainingDataModule } from './modules/training-data/training-data.module';
import { BaseEntitySubscriber } from './common/subscribers';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // cho phép dùng toàn dự án
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'chatbot',
        autoLoadEntities: true,
        synchronize: true,
        subscribers: [BaseEntitySubscriber],
      }),
    }),
    // RBAC Modules
    SystemRolesModule,
    WorkspaceRolesModule,
    WorkspacePermissionsModule,
    WorkspaceRolePermissionsModule,
    WorkspaceMemberPermissionsModule,
    RbacSeedModule,
    // Core Modules
    UsersModule,
    WorkspacesModule,
    WorkspaceMembersModule,
    WorkspaceInvitationsModule,
    // Chatbot Modules
    ChatbotsModule,
    CustomIntentsModule,
    CustomResponsesModule,
    TrainingDataModule,
    // Chat Modules
    ConversationsModule,
    MessagesModule,
    IntentsModule,
    ActionsModule,
    // Integration Modules
    DocumentsModule,
    EventsModule,
    PaymentsModule,
    // Auth & Mail Modules
    AuthModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
