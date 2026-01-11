import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemRolesController } from './system-roles.controller';
import { SystemRolesService } from './system-roles.service';
import { SystemRole } from './entities/system-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemRole])],
  controllers: [SystemRolesController],
  providers: [SystemRolesService],
  exports: [SystemRolesService, TypeOrmModule],
})
export class SystemRolesModule {}
