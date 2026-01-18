"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const users_module_1 = require("./users/users.module");
const groups_module_1 = require("./groups/groups.module");
const conversations_module_1 = require("./conversations/conversations.module");
const messages_module_1 = require("./messages/messages.module");
const intents_module_1 = require("./intents/intents.module");
const actions_module_1 = require("./actions/actions.module");
const documents_module_1 = require("./documents/documents.module");
const events_module_1 = require("./events/events.module");
const payments_module_1 = require("./payments/payments.module");
const group_members_module_1 = require("./group-members/group-members.module");
const rag_module_1 = require("./rag/rag.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env'],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
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
            users_module_1.UsersModule,
            groups_module_1.GroupsModule,
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            intents_module_1.IntentsModule,
            actions_module_1.ActionsModule,
            documents_module_1.DocumentsModule,
            events_module_1.EventsModule,
            payments_module_1.PaymentsModule,
            group_members_module_1.GroupMembersModule,
            rag_module_1.RagModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map