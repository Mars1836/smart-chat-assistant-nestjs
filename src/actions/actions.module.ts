import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Action } from './entities/action.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Action])],
  exports: [TypeOrmModule],
})
export class ActionsModule {}
