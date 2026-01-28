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
const users_module_1 = require("./modules/users/users.module");
const workspaces_module_1 = require("./modules/workspaces/workspaces.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const messages_module_1 = require("./modules/messages/messages.module");
const intents_module_1 = require("./modules/intents/intents.module");
const actions_module_1 = require("./modules/actions/actions.module");
const documents_module_1 = require("./modules/documents/documents.module");
const events_module_1 = require("./modules/events/events.module");
const payments_module_1 = require("./modules/payments/payments.module");
const workspace_members_module_1 = require("./modules/workspace-members/workspace-members.module");
const auth_module_1 = require("./modules/auth/auth.module");
const system_roles_module_1 = require("./modules/system-roles/system-roles.module");
const workspace_roles_module_1 = require("./modules/workspace-roles/workspace-roles.module");
const workspace_member_permissions_module_1 = require("./modules/workspace-member-permissions/workspace-member-permissions.module");
const workspace_role_permissions_module_1 = require("./modules/workspace-role-permissions/workspace-role-permissions.module");
const workspace_permissions_module_1 = require("./modules/workspace-permissions/workspace-permissions.module");
const workspace_invitations_module_1 = require("./modules/workspace-invitations/workspace-invitations.module");
const rbac_seed_module_1 = require("./modules/rbac-seed/rbac-seed.module");
const chatbots_module_1 = require("./modules/chatbots/chatbots.module");
const rag_module_1 = require("./modules/rag/rag.module");
const custom_intents_module_1 = require("./modules/custom-intents/custom-intents.module");
const custom_responses_module_1 = require("./modules/custom-responses/custom-responses.module");
const training_data_module_1 = require("./modules/training-data/training-data.module");
const subscribers_1 = require("./common/subscribers");
const mail_module_1 = require("./modules/mail/mail.module");
const bullmq_1 = require("@nestjs/bullmq");
const tools_module_1 = require("./modules/tools/tools.module");
const knowledge_module_1 = require("./modules/knowledge/knowledge.module");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const widget_module_1 = require("./modules/widget/widget.module");
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
                    subscribers: [subscribers_1.BaseEntitySubscriber],
                }),
            }),
            bullmq_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    connection: {
                        host: configService.get('REDIS_HOST') ?? 'localhost',
                        port: Number(configService.get('REDIS_PORT') ?? 6379),
                    },
                }),
                inject: [config_1.ConfigService],
            }),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(process.cwd(), 'uploads'),
                serveRoot: '/uploads',
            }),
            system_roles_module_1.SystemRolesModule,
            workspace_roles_module_1.WorkspaceRolesModule,
            workspace_permissions_module_1.WorkspacePermissionsModule,
            workspace_role_permissions_module_1.WorkspaceRolePermissionsModule,
            workspace_member_permissions_module_1.WorkspaceMemberPermissionsModule,
            rbac_seed_module_1.RbacSeedModule,
            users_module_1.UsersModule,
            workspaces_module_1.WorkspacesModule,
            workspace_members_module_1.WorkspaceMembersModule,
            workspace_invitations_module_1.WorkspaceInvitationsModule,
            chatbots_module_1.ChatbotsModule,
            rag_module_1.RagModule,
            knowledge_module_1.KnowledgeModule,
            tools_module_1.ToolsModule,
            widget_module_1.WidgetModule,
            custom_intents_module_1.CustomIntentsModule,
            custom_responses_module_1.CustomResponsesModule,
            training_data_module_1.TrainingDataModule,
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            intents_module_1.IntentsModule,
            actions_module_1.ActionsModule,
            documents_module_1.DocumentsModule,
            events_module_1.EventsModule,
            payments_module_1.PaymentsModule,
            auth_module_1.AuthModule,
            mail_module_1.MailModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map