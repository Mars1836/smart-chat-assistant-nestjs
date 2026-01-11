import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingData } from './entities/training-data.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TrainingData])],
  exports: [TypeOrmModule],
})
export class TrainingDataModule {}
