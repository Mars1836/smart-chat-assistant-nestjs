import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { SystemRole } from '../system-roles/entities/system-role.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SystemAdminGuard } from './guards/system-admin.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SystemRole]),
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, SystemAdminGuard],
  exports: [TypeOrmModule, UsersService, SystemAdminGuard],
})
export class UsersModule {}
