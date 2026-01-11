import { DataSource } from 'typeorm';
import { SystemRole } from '../../modules/system-roles/entities/system-role.entity';
import { WorkspaceRole } from '../../modules/workspace-roles/entities/workspace-role.entity';
import { WorkspacePermission } from '../../modules/workspace-permissions/entities/workspace-permission.entity';

export async function seedRBAC(dataSource: DataSource): Promise<void> {
  console.log('🌱 Seeding RBAC data...');

  // 1. Seed System Roles
  const systemRoleRepo = dataSource.getRepository(SystemRole);
  const existingSystemRoles = await systemRoleRepo.count();

  if (existingSystemRoles === 0) {
    console.log('  → Seeding system_roles...');
    const systemRoles = systemRoleRepo.create([
      {
        name: 'admin',
        description:
          'Quản trị viên hệ thống - Quản lý toàn bộ server, users, groups',
      },
      {
        name: 'user',
        description:
          'Người dùng thường - Có thể tạo workspaces và tham gia workspaces',
      },
    ]);
    await systemRoleRepo.save(systemRoles);
    console.log('    ✓ Created 2 system roles');
  } else {
    console.log('    ⚠ System roles already exist, skipping...');
  }

  // 2. Seed Workspace Roles
  const workspaceRoleRepo = dataSource.getRepository(WorkspaceRole);
  const existingWorkspaceRoles = await workspaceRoleRepo.count();

  if (existingWorkspaceRoles === 0) {
    console.log('  → Seeding workspace_roles...');
    const workspaceRoles = workspaceRoleRepo.create([
      {
        name: 'owner',
        description: 'Chủ workspace - Full quyền quản lý workspace',
        level: 1,
      },
      {
        name: 'moderator',
        description: 'Quản lý viên - Quản lý nội dung và members',
        level: 2,
      },
      {
        name: 'member',
        description: 'Thành viên - Quyền cơ bản',
        level: 3,
      },
    ]);
    await workspaceRoleRepo.save(workspaceRoles);
    console.log('    ✓ Created 3 workspace roles');
  } else {
    console.log('    ⚠ Workspace roles already exist, skipping...');
  }

  // 3. Seed Workspace Permissions
  const permissionRepo = dataSource.getRepository(WorkspacePermission);
  const existingPermissions = await permissionRepo.count();

  if (existingPermissions === 0) {
    console.log('  → Seeding workspace_permissions...');
    const permissions = permissionRepo.create([
      // Workspace Management
      {
        name: 'workspace.update',
        category: 'workspace',
        action: 'update',
        description: 'Chỉnh sửa thông tin workspace (tên, mô tả)',
      },
      {
        name: 'workspace.delete',
        category: 'workspace',
        action: 'delete',
        description: 'Xóa workspace',
      },
      {
        name: 'workspace.settings',
        category: 'workspace',
        action: 'manage',
        description: 'Quản lý cài đặt workspace',
      },

      // Member Management
      {
        name: 'member.invite',
        category: 'member',
        action: 'create',
        description: 'Mời thành viên mới',
      },
      {
        name: 'member.remove',
        category: 'member',
        action: 'delete',
        description: 'Xóa thành viên',
      },
      {
        name: 'member.role',
        category: 'member',
        action: 'update',
        description: 'Thay đổi vai trò thành viên',
      },
      {
        name: 'member.view',
        category: 'member',
        action: 'read',
        description: 'Xem danh sách thành viên',
      },

      // Chatbot Management
      {
        name: 'chatbot.configure',
        category: 'chatbot',
        action: 'update',
        description: 'Cấu hình chatbot (intents, responses)',
      },
      {
        name: 'chatbot.train',
        category: 'chatbot',
        action: 'execute',
        description: 'Train lại AI model',
      },
      {
        name: 'chatbot.enable',
        category: 'chatbot',
        action: 'update',
        description: 'Bật/tắt chatbot trong workspace',
      },
      {
        name: 'chatbot.view_logs',
        category: 'chatbot',
        action: 'read',
        description: 'Xem logs của chatbot',
      },
      {
        name: 'chatbot.delete_data',
        category: 'chatbot',
        action: 'delete',
        description: 'Xóa dữ liệu training',
      },

      // Email Features
      {
        name: 'email.send',
        category: 'email',
        action: 'create',
        description: 'Gửi email qua chatbot',
      },
      {
        name: 'email.send_workspace',
        category: 'email',
        action: 'create',
        description: 'Gửi email hàng loạt cho workspace',
      },
      {
        name: 'email.configure',
        category: 'email',
        action: 'update',
        description: 'Cấu hình email templates',
      },
      {
        name: 'email.view_history',
        category: 'email',
        action: 'read',
        description: 'Xem lịch sử email đã gửi',
      },

      // Calendar Features
      {
        name: 'calendar.create',
        category: 'calendar',
        action: 'create',
        description: 'Tạo sự kiện lịch cho workspace',
      },
      {
        name: 'calendar.edit',
        category: 'calendar',
        action: 'update',
        description: 'Chỉnh sửa sự kiện',
      },
      {
        name: 'calendar.delete',
        category: 'calendar',
        action: 'delete',
        description: 'Xóa sự kiện',
      },
      {
        name: 'calendar.view',
        category: 'calendar',
        action: 'read',
        description: 'Xem lịch workspace',
      },

      // Document Management
      {
        name: 'document.upload',
        category: 'document',
        action: 'create',
        description: 'Upload tài liệu vào workspace',
      },
      {
        name: 'document.delete',
        category: 'document',
        action: 'delete',
        description: 'Xóa tài liệu',
      },
      {
        name: 'document.view',
        category: 'document',
        action: 'read',
        description: 'Xem tài liệu',
      },

      // Chat Features
      {
        name: 'chat.send',
        category: 'chat',
        action: 'create',
        description: 'Gửi tin nhắn trong workspace',
      },
      {
        name: 'chat.delete',
        category: 'chat',
        action: 'delete',
        description: 'Xóa tin nhắn (của mình hoặc người khác)',
      },
      {
        name: 'chat.view_history',
        category: 'chat',
        action: 'read',
        description: 'Xem lịch sử chat',
      },
    ]);

    await permissionRepo.save(permissions);
    console.log(`    ✓ Created ${permissions.length} workspace permissions`);
  } else {
    console.log('    ⚠ Workspace permissions already exist, skipping...');
  }

  console.log(
    '  ℹ Note: Permission assignment to roles should be done via workspace_role_permissions table',
  );

  console.log('✅ RBAC seeding completed!\n');
}
