import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WidgetService } from './widget.service';
import { WidgetChatDto, WidgetChatResponseDto } from './dto/widget-chat.dto';

@ApiTags('widget')
@Controller('public/widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Public chat cho widget (không cần JWT)' })
  @ApiResponse({
    status: 200,
    description: 'Chat response cho widget',
    type: WidgetChatResponseDto,
  })
  async chat(@Body() dto: WidgetChatDto): Promise<WidgetChatResponseDto> {
    const result = await this.widgetService.chat(dto);
    return {
      response: result.response,
      conversation_id: result.conversation_id,
      files: result.files,
      cards: result.cards,
    };
  }
}

