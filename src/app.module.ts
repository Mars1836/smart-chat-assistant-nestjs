import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { IntentsModule } from './intents/intents.module';
import { ActionsModule } from './actions/actions.module';
import { DocumentsModule } from './documents/documents.module';
import { EventsModule } from './events/events.module';
import { PaymentsModule } from './payments/payments.module';
import { GroupMembersModule } from './group-members/group-members.module';
import { RagModule } from './rag/rag.module';

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
      }),
    }),
    UsersModule,
    GroupsModule,
    ConversationsModule,
    MessagesModule,
    IntentsModule,
    ActionsModule,
    DocumentsModule,
    EventsModule,
    PaymentsModule,
    GroupMembersModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
