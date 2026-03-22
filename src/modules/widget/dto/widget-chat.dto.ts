import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';

export class WidgetChatDto {
  @IsUUID()
  chatbotId: string;

  @IsString()
  message: string;

  // Optional: conversation_id để tiếp tục hội thoại
  @IsOptional()
  @IsUUID()
  conversation_id?: string;

  // Optional: client-defined visitor id
  @IsOptional()
  @IsString()
  visitorId?: string;

  // Optional: page url, user agent, etc.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class WidgetChatResponseDto {
  response: string;
  conversation_id: string;
  files?: any[];
  cards?: any[];
}

