import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Document } from './entities/document.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Workspace]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'your-secret-key',
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN') ?? '1h',
        } as any,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [TypeOrmModule, DocumentsService],
})
export class DocumentsModule {}
