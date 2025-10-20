import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Intent } from './entities/intent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Intent])],
  exports: [TypeOrmModule],
})
export class IntentsModule {}


