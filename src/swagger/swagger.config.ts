import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Smart Chat Assistant API')
  .setDescription(
    `API documentation for Smart Chat Assistant - A workspace-based chatbot system with:
    
- **Knowledge Bases**: Upload documents, images → RAG search
- **Plugins**: Gmail, APIs with OAuth/API Key authentication
- **Chatbots**: AI-powered with tool calling capabilities
- **RBAC**: Workspace-level permissions`,
  )
  .setVersion('3.0')
  .setContact(
    'Vũ Công Hậu',
    'https://github.com/your-username',
    'your-email@example.com',
  )
  .setLicense('MIT', 'https://opensource.org/licenses/MIT')

  // ========================
  // AUTHENTICATION
  // ========================
  .addTag('auth', 'Authentication & Authorization (Login, Register, JWT)')

  // ========================
  // RBAC - SYSTEM LEVEL
  // ========================
  .addTag('system-roles', 'System Roles (Admin, User)')

  // ========================
  // WORKSPACES & MEMBERS
  // ========================
  .addTag('workspaces', 'Workspace Management')
  .addTag('workspace-members', 'Workspace Members')
  .addTag('workspace-invitations', 'Workspace Invitations')
  .addTag('workspace-roles', 'Workspace Roles (Owner, Moderator, Member)')
  .addTag('workspace-permissions', 'Workspace Permissions')

  // ========================
  // KNOWLEDGE BASES (RAG)
  // ========================
  .addTag(
    'knowledge',
    'Knowledge Base Management - Create knowledge bases, upload documents/images for RAG',
  )
  .addTag(
    'chatbot-knowledge',
    'Chatbot Knowledge Selection - Link chatbots to knowledge bases',
  )
  .addTag(
    'documents',
    'Document Upload - Upload PDF, DOCX, TXT, Images to knowledge bases',
  )

  // ========================
  // PLUGINS (TOOLS)
  // ========================
  .addTag(
    'tools',
    'Global Tools/Plugins - System-wide tool definitions (Admin only)',
  )
  .addTag(
    'workspace-tools',
    'Workspace Plugins - Install/configure plugins for workspace',
  )
  .addTag(
    'chatbot-tools',
    'Chatbot Plugins - Enable/disable plugins and actions for chatbots',
  )
  .addTag('oauth', 'OAuth Authentication - Connect user accounts (Gmail, etc.)')

  // ========================
  // CHATBOTS
  // ========================
  .addTag('chatbots', 'Chatbot Configuration & Chat')
  .addTag('custom-intents', 'Custom Intents for Chatbots')
  .addTag('custom-responses', 'Custom Response Templates')
  .addTag('training-data', 'Training Data Management')

  // ========================
  // CHAT & CONVERSATIONS
  // ========================
  .addTag('conversations', 'Chat Conversations')
  .addTag('messages', 'Chat Messages')
  .addTag('intents', 'Intent Detection')
  .addTag('actions', 'Bot Actions & Executions')

  // ========================
  // INTEGRATIONS
  // ========================
  .addTag('events', 'Calendar Events (Google Calendar)')
  .addTag('payments', 'Payment Transactions (ZaloPay)')

  // ========================
  // USER MANAGEMENT
  // ========================
  .addTag('users', 'User Profiles')

  // ========================
  // AUTH SCHEME
  // ========================
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
