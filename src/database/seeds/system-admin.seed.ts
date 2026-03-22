import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../modules/users/entities/user.entity';
import { SystemRole } from '../../modules/system-roles/entities/system-role.entity';

/**
 * Seed a default system administrator user.
 *
 * - Creates a SystemRole with name 'admin' (theo entity.md: admin, user) nếu chưa có.
 * - Tạo User gán role admin nếu email chưa tồn tại.
 *
 * Idempotent, chạy nhiều lần an toàn.
 */
export async function seedSystemAdmin(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const systemRoleRepo = dataSource.getRepository(SystemRole);

  // Theo entity.md §3: system_roles có admin, user
  const adminRoleName = 'admin';

  // 1. Đảm bảo role 'admin' tồn tại
  let adminRole = await systemRoleRepo.findOne({
    where: { name: adminRoleName },
  });

  if (!adminRole) {
    adminRole = systemRoleRepo.create({
      name: adminRoleName,
      description: 'Quản trị viên hệ thống - Quản lý toàn bộ server, users, groups.',
    });
    adminRole = await systemRoleRepo.save(adminRole);
    console.log(`  + Created system role: ${adminRoleName}`);
  } else {
    console.log(`  ↻ System role already exists: ${adminRoleName}`);
  }

  // 2. Ensure a default admin user exists
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  let adminUser = await userRepo.findOne({
    where: { email: adminEmail },
    relations: ['systemRole'],
  });

  if (adminUser) {
    // Nếu user đã có nhưng chưa gán role, gán role admin
    if (!adminUser.system_role_id || adminUser.is_deleted) {
      adminUser.system_role_id = adminRole.id;
      adminUser.is_deleted = false;
      await userRepo.save(adminUser);
      console.log(`  ↻ Updated existing user to admin role: ${adminEmail}`);
    } else {
      console.log(`  ↻ Admin user already exists: ${adminEmail}`);
    }
    return;
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

  adminUser = userRepo.create({
    name: 'System Admin',
    email: adminEmail,
    password: hashedPassword,
    language: 'vi',
    avatar_url: null,
    google_id: null,
    system_role_id: adminRole.id,
  });

  await userRepo.save(adminUser);

  console.log('  + Created system admin user:');
  console.log(`    Email   : ${adminEmail}`);
  console.log(`    Password: ${adminPassword}`);
}

