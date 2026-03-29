import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { WidgetService } from './widget.service';
import { WidgetChatDto, WidgetChatResponseDto } from './dto/widget-chat.dto';
import { WidgetSecurityService } from './widget-security.service';
import { WidgetPublicConfigDto } from './dto/widget-public-config.dto';

@ApiTags('widget')
@Controller('public/widget')
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly widgetSecurityService: WidgetSecurityService,
  ) {}

  @Get('config/:chatbotId')
  @ApiOperation({
    summary: 'Lay public config cho widget',
    description:
      'Tra ve cau hinh an toan cho FE widget, bao gom UI, greeting message va conversation starters. Endpoint nay ap dung whitelist/API key giong widget chat, nhung khong tieu ton rate limit chat.',
  })
  @ApiHeader({
    name: 'X-Widget-Key',
    required: false,
    description:
      'API key cong khai cua widget. Bat buoc neu chatbot co cau hinh public_api_key.',
  })
  @ApiParam({
    name: 'chatbotId',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Public widget config',
    type: WidgetPublicConfigDto,
  })
  async getConfig(
    @Req() req: Request,
    @Res() res: Response,
    @Param('chatbotId') chatbotId: string,
  ): Promise<void> {
    const { chatbot, widgetConfig } =
      await this.widgetSecurityService.validateAccessAndGetChatbot(
        req,
        chatbotId,
      );

    res
      .status(HttpStatus.OK)
      .json(this.widgetService.getPublicConfig(chatbot, widgetConfig));
  }

  @Post('chat')
  @ApiOperation({
    summary:
      'Public chat cho widget (không cần JWT, có whitelist + rate limit)',
    description:
      'Endpoint public dành cho widget embed từ website bên ngoài.\n\n' +
      '- Backend sẽ kiểm tra origin/IP theo cấu hình whitelist của từng chatbot.\n' +
      '- Có thể yêu cầu FE gửi header `X-Widget-Key` nếu chatbot bật API key công khai.\n' +
      '- Áp dụng rate limit theo IP / origin / API key tùy config.',
  })
  @ApiHeader({
    name: 'X-Widget-Key',
    required: false,
    description:
      'API key công khai của widget. Bắt buộc nếu chatbot có cấu hình `public_api_key` trong widget_config.security.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat response cho widget',
    type: WidgetChatResponseDto,
  })
  async chat(
    @Req() req: Request,
    @Body() dto: WidgetChatDto,
    @Res() res: Response,
  ): Promise<void> {
    const { rateLimited } =
      await this.widgetSecurityService.validateRequestAndGetChatbot(
        req,
        dto.chatbotId,
      );

    if (rateLimited) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests',
        error: 'Too Many Requests',
      });
      return;
    }

    const result = await this.widgetService.chat(dto);
    res.status(HttpStatus.OK).json({
      response: result.response,
      conversation_id: result.conversation_id,
      files: result.files,
      cards: result.cards,
    });
  }
}
