import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { AuthModule } from '../auth/auth.module';
import { SpeechController } from './speech.controller';
import { SpeechService } from './speech.service';

@Module({
  imports: [TypeOrmModule.forFeature([Chatbot]), AuthModule],
  controllers: [SpeechController],
  providers: [SpeechService],
  exports: [SpeechService],
})
export class SpeechModule {}
