import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ingest')
  async ingest(@Body() body: { text: string; metadata?: any }) {
    await this.ragService.ingest(body.text, body.metadata);
    return { success: true };
  }

  @Post('ask')
  async ask(@Body() body: { question: string }) {
    const answer = await this.ragService.ask(body.question);
    return { answer };
  }
}
