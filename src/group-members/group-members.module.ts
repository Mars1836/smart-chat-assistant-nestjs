import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupMember } from './entities/group-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GroupMember])],
  exports: [TypeOrmModule],
})
export class GroupMembersModule {}
