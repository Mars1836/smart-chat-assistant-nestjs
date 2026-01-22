export const WORKSPACE_PERMISSIONS = {
  // Workspace Management
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_DELETE: 'workspace.delete',
  WORKSPACE_VIEW_SETTINGS: 'workspace.view_settings',
  WORKSPACE_MANAGE_PLUGINS: 'workspace.manage_plugins',

  // Member Management
  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_UPDATE_ROLE: 'member.update_role',
  MEMBER_VIEW: 'member.view',

  // Chatbot Resources
  CHATBOT_CREATE: 'chatbot.create',
  CHATBOT_UPDATE: 'chatbot.update',
  CHATBOT_DELETE: 'chatbot.delete',
  CHATBOT_VIEW: 'chatbot.view',
  CHATBOT_CHAT: 'chatbot.chat',
  CHATBOT_VIEW_LOGS: 'chatbot.view_logs',

  // Document Resources
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_UPDATE: 'document.update',
  DOCUMENT_DELETE: 'document.delete',
  DOCUMENT_VIEW: 'document.view',
} as const;

export type WorkspacePermissionType =
  (typeof WORKSPACE_PERMISSIONS)[keyof typeof WORKSPACE_PERMISSIONS];

export const WORKSPACE_ROLES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
} as const;

export type WorkspaceRoleType =
  (typeof WORKSPACE_ROLES)[keyof typeof WORKSPACE_ROLES];
