import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomIntent } from './entities/custom-intent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomIntent])],
  exports: [TypeOrmModule],
})
export class CustomIntentsModule {}
