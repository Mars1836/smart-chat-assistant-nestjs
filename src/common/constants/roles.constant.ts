export const SYSTEM_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const GROUP_ROLES = {
  OWNER: 'owner',
  MODERATOR: 'moderator',
  MEMBER: 'member',
} as const;

export type GroupRole = (typeof GROUP_ROLES)[keyof typeof GROUP_ROLES];
