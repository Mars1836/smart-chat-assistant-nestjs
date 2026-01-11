import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomResponse } from './entities/custom-response.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomResponse])],
  exports: [TypeOrmModule],
})
export class CustomResponsesModule {}

