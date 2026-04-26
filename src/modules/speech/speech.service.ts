import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Chatbot } from '../chatbots/entities/chatbot.entity';

@Injectable()
export class SpeechService {
  private readonly geminiBaseUrl =
    'https://generativelanguage.googleapis.com/v1beta';
  private readonly googleSpeechBaseUrl = 'https://speech.googleapis.com/v1';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Chatbot)
    private readonly chatbotRepo: Repository<Chatbot>,
  ) {}

  private assertSpeechEnabled() {
    const enabled = String(this.configService.get('ENABLE_SPEECH') ?? 'false')
      .trim()
      .toLowerCase();

    if (!(enabled === '1' || enabled === 'true' || enabled === 'yes')) {
      throw new ServiceUnavailableException(
        'Speech feature is disabled. Set ENABLE_SPEECH=true to enable.',
      );
    }
  }

  private getSttProvider(): string {
    return String(
      this.configService.get('SPEECH_STT_PROVIDER') ??
        'google_speech',
    )
      .trim()
      .toLowerCase();
  }

  private getTtsProvider(): string {
    return String(
      this.configService.get('SPEECH_TTS_PROVIDER') ??
        this.configService.get('SPEECH_PROVIDER') ??
        'gemini',
    )
      .trim()
      .toLowerCase();
  }

  private getGoogleSpeechEncoding(mimeType: string): string | undefined {
    const normalized = mimeType.toLowerCase();

    if (normalized.includes('webm')) return 'WEBM_OPUS';
    if (normalized.includes('ogg') || normalized.includes('opus')) {
      return 'OGG_OPUS';
    }
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'MP3';
    if (normalized.includes('flac')) return 'FLAC';
    if (normalized.includes('wav') || normalized.includes('wave')) {
      return 'LINEAR16';
    }

    return undefined;
  }

  private async assertChatbotBelongsToWorkspace(
    workspaceId: string,
    chatbotId: string,
  ): Promise<Chatbot> {
    const chatbot = await this.chatbotRepo.findOne({
      where: { id: chatbotId, workspace_id: workspaceId },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    return chatbot;
  }

  async speechToText(params: {
    workspaceId: string;
    chatbotId: string;
    audioBuffer: Buffer;
    mimeType: string;
  }): Promise<{ text: string; provider: string; model: string }> {
    this.assertSpeechEnabled();
    await this.assertChatbotBelongsToWorkspace(
      params.workspaceId,
      params.chatbotId,
    );

    const provider = this.getSttProvider();
    if (provider !== 'google_speech') {
      throw new ServiceUnavailableException(
        `Unsupported speech-to-text provider "${provider}".`,
      );
    }

    const apiKey =
      this.configService.get<string>('GOOGLE_SPEECH_API_KEY') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GOOGLE_SPEECH_API_KEY is not configured.',
      );
    }

    const model =
      this.configService.get<string>('GOOGLE_SPEECH_MODEL') ?? 'latest_short';
    const languageCode =
      this.configService.get<string>('GOOGLE_SPEECH_LANGUAGE_CODE') ?? 'vi-VN';
    const alternativeLanguageCodes = String(
      this.configService.get<string>('GOOGLE_SPEECH_ALTERNATIVE_LANGUAGES') ??
        'en-US',
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const encoding = this.getGoogleSpeechEncoding(params.mimeType);
    const sampleRateHertz = Number(
      this.configService.get<string>('GOOGLE_SPEECH_SAMPLE_RATE_HERTZ') ??
        48000,
    );
    const config: Record<string, any> = {
      languageCode,
      alternativeLanguageCodes,
      model,
      enableAutomaticPunctuation: true,
    };

    if (encoding) {
      config.encoding = encoding;
    }

    if (encoding === 'WEBM_OPUS' || encoding === 'OGG_OPUS') {
      config.sampleRateHertz = sampleRateHertz;
    }

    const body = {
      config,
      audio: {
        content: params.audioBuffer.toString('base64'),
      },
    };

    const response = await fetch(
      `${this.googleSpeechBaseUrl}/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ServiceUnavailableException(
        `Google Speech-to-Text error: ${response.status} - ${errorText}`,
      );
    }

    const data = (await response.json()) as any;
    const text = (data?.results ?? [])
      .map((result: any) => result?.alternatives?.[0]?.transcript)
      .filter((transcript: any) => typeof transcript === 'string')
      .join('\n')
      .trim();

    return { text: text || '', provider, model };
  }

  async textToSpeech(params: {
    workspaceId: string;
    chatbotId: string;
    text: string;
    voice?: string;
    speakingRate?: number;
  }): Promise<{
    provider: string;
    model: string;
    audio_url: string;
    mime_type: string;
    size: number;
  }> {
    this.assertSpeechEnabled();
    await this.assertChatbotBelongsToWorkspace(
      params.workspaceId,
      params.chatbotId,
    );

    const provider = this.getTtsProvider();
    if (provider !== 'gemini') {
      throw new ServiceUnavailableException(
        `Unsupported speech provider "${provider}".`,
      );
    }

    const apiKey =
      this.configService.get<string>('GOOGLE_AI_STUDIO_API_KEY') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GOOGLE_AI_STUDIO_API_KEY is not configured.',
      );
    }

    const model =
      this.configService.get<string>('GEMINI_TTS_MODEL') ??
      'gemini-2.5-flash-preview-tts';
    const voice =
      params.voice ??
      this.configService.get<string>('GEMINI_TTS_VOICE') ??
      'Kore';
    const speakingRate = params.speakingRate ?? 1;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: params.text }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
          speakingRate,
        },
      },
    };

    const response = await fetch(
      `${this.geminiBaseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ServiceUnavailableException(
        `Gemini TTS error: ${response.status} - ${errorText}`,
      );
    }

    const data = (await response.json()) as any;
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find(
      (p: any) => p?.inlineData?.data || p?.inline_data?.data,
    );
    const inlineData = audioPart?.inlineData ?? audioPart?.inline_data;
    const base64Audio = inlineData?.data;
    const mimeType =
      inlineData?.mimeType ?? inlineData?.mime_type ?? 'audio/wav';

    if (!base64Audio) {
      throw new ServiceUnavailableException(
        'Gemini TTS returned no audio payload.',
      );
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const ext = mimeType.includes('mpeg')
      ? 'mp3'
      : mimeType.includes('ogg')
        ? 'ogg'
        : mimeType.includes('webm')
          ? 'webm'
          : 'wav';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const saveDir = path.join(
      process.cwd(),
      'uploads',
      'tts',
      params.workspaceId,
      params.chatbotId,
    );

    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    const fullPath = path.join(saveDir, fileName);
    fs.writeFileSync(fullPath, audioBuffer);

    return {
      provider,
      model,
      audio_url: `/uploads/tts/${params.workspaceId}/${params.chatbotId}/${fileName}`,
      mime_type: mimeType,
      size: audioBuffer.byteLength,
    };
  }
}
