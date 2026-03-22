import { DataSource, IsNull } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { SystemRole } from '../../modules/system-roles/entities/system-role.entity';

/**
 * Ensure default system role "user" exists and assign it
 * to all users without a system role.
 *
 * Idempotent: safe to run multiple times.
 */
export async function seedDefaultUserRole(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const systemRoleRepo = dataSource.getRepository(SystemRole);

  const userRoleName = 'user';
  let userRole = await systemRoleRepo.findOne({
    where: { name: userRoleName },
  });

  if (!userRole) {
    userRole = systemRoleRepo.create({
      name: userRoleName,
      description: 'Người dùng mặc định của hệ thống',
    });
    userRole = await systemRoleRepo.save(userRole);
    console.log(`  + Created system role: ${userRoleName}`);
  } else {
    console.log(`  ↻ System role already exists: ${userRoleName}`);
  }

  const usersWithoutRole = await userRepo.count({
    where: { system_role_id: IsNull(), is_deleted: false },
  });

  if (usersWithoutRole === 0) {
    console.log('  ↻ No users without system role');
    return;
  }

  await userRepo.update(
    { system_role_id: IsNull(), is_deleted: false },
    { system_role_id: userRole.id },
  );
  console.log(`  + Assigned role "${userRoleName}" to ${usersWithoutRole} users`);
}
