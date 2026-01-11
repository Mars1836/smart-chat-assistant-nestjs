import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Smart Chat Assistant API')
  .setDescription(
    'API documentation for Smart Chat Assistant - A workspace-based chatbot system with Gmail, Google Calendar integration, and document processing',
  )
  .setVersion('2.0')
  .setContact(
    'Vũ Công Hậu',
    'https://github.com/your-username',
    'your-email@example.com',
  )
  .setLicense('MIT', 'https://opensource.org/licenses/MIT')
  // Authentication
  .addTag('auth', 'Authentication & Authorization')
  // RBAC - System Level
  .addTag('system-roles', 'System Roles (Admin, User)')
  // Workspaces & Members
  .addTag('workspaces', 'Workspace Management')
  .addTag('workspace-members', 'Workspace Members')
  .addTag('workspace-roles', 'Workspace Roles (Owner, Moderator, Member)')
  .addTag('workspace-permissions', 'Workspace Permissions')
  // Chatbots
  .addTag('chatbots', 'Chatbot Configuration')
  .addTag('custom-intents', 'Custom Intents for Chatbots')
  .addTag('custom-responses', 'Custom Response Templates')
  .addTag('training-data', 'Training Data Management')
  // Chat & Conversations
  .addTag('conversations', 'Chat Conversations')
  .addTag('messages', 'Chat Messages')
  .addTag('intents', 'Intent Detection (Rasa)')
  .addTag('actions', 'Bot Actions & Executions')
  // Integrations
  .addTag('documents', 'Document Management & RAG')
  .addTag('events', 'Calendar Events (Google Calendar)')
  .addTag('payments', 'Payment Transactions (ZaloPay)')
  // User Management
  .addTag('users', 'User Profiles')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .build();
