import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'group-permissions';

/**
 * Decorator để yêu cầu permissions trong group
 * @param permissions - Danh sách permissions cần thiết
 * @example
 * ```typescript
 * @GroupPermissions('chatbot.configure', 'chatbot.train')
 * @UseGuards(JwtAuthGuard, GroupPermissionsGuard)
 * async configureChatbot(@Param('groupId') groupId: string) {
 *   // Only users with chatbot.configure or chatbot.train permission can access
 * }
 * ```
 */
export const GroupPermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
