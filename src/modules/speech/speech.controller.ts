import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { SpeechService } from './speech.service';
import { TextToSpeechDto } from './dto/speech.dto';

@ApiTags('speech')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/chatbots/:chatbotId/speech')
export class SpeechController {
  constructor(private readonly speechService: SpeechService) {}

  @Post('stt')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('audio/')) {
          return cb(new Error('Only audio files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_CHAT)
  @ApiOperation({ summary: 'Speech-to-Text (Google Speech-to-Text)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: { type: 'string', format: 'binary' },
      },
      required: ['audio'],
    },
  })
  @ApiResponse({ status: 200, description: 'Transcribed text' })
  async speechToText(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
    @UploadedFile() audio: Express.Multer.File,
  ) {
    return this.speechService.speechToText({
      workspaceId,
      chatbotId,
      audioBuffer: audio.buffer,
      mimeType: audio.mimetype,
    });
  }

  @Post('tts')
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_CHAT)
  @ApiOperation({ summary: 'Text-to-Speech (Gemini Audio)' })
  @ApiResponse({ status: 200, description: 'Audio file URL for playback' })
  async textToSpeech(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
    @Body() dto: TextToSpeechDto,
  ) {
    return this.speechService.textToSpeech({
      workspaceId,
      chatbotId,
      text: dto.text,
      voice: dto.voice,
      speakingRate: dto.speaking_rate,
    });
  }
}
