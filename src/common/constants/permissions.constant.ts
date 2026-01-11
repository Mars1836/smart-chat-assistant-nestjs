export const GROUP_PERMISSIONS = {
  // Group Management
  GROUP_UPDATE: 'group.update',
  GROUP_DELETE: 'group.delete',
  GROUP_SETTINGS: 'group.settings',

  // Member Management
  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_ROLE: 'member.role',
  MEMBER_VIEW: 'member.view',

  // Chatbot Management
  CHATBOT_CONFIGURE: 'chatbot.configure',
  CHATBOT_TRAIN: 'chatbot.train',
  CHATBOT_ENABLE: 'chatbot.enable',
  CHATBOT_VIEW_LOGS: 'chatbot.view_logs',
  CHATBOT_DELETE_DATA: 'chatbot.delete_data',

  // Email Features
  EMAIL_SEND: 'email.send',
  EMAIL_SEND_GROUP: 'email.send_group',
  EMAIL_CONFIGURE: 'email.configure',
  EMAIL_VIEW_HISTORY: 'email.view_history',

  // Calendar Features
  CALENDAR_CREATE: 'calendar.create',
  CALENDAR_EDIT: 'calendar.edit',
  CALENDAR_DELETE: 'calendar.delete',
  CALENDAR_VIEW: 'calendar.view',

  // Document Management
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_DELETE: 'document.delete',
  DOCUMENT_VIEW: 'document.view',

  // Chat Features
  CHAT_SEND: 'chat.send',
  CHAT_DELETE: 'chat.delete',
  CHAT_VIEW_HISTORY: 'chat.view_history',
} as const;

export type GroupPermission =
  (typeof GROUP_PERMISSIONS)[keyof typeof GROUP_PERMISSIONS];
