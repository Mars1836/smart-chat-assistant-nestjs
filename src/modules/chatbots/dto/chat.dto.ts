import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ChatDto {
  @ApiProperty({
    description: 'Tin nhắn của user',
    example: 'Hôm nay thời tiết thế nào?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'ID của conversation (phải tạo trước qua API conversations)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  conversation_id: string;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'ID của conversation',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  conversation_id: string;

  @ApiProperty({
    description: 'Response từ chatbot',
    example: 'Tôi xin lỗi, tôi không thể kiểm tra thời tiết...',
  })
  response: string;

  @ApiProperty({
    description: 'Model được sử dụng',
    example: 'gemini-1.5-flash',
  })
  model: string;

  @ApiProperty({
    description: 'Thời gian xử lý (ms)',
    example: 1234,
  })
  processingTime: number;
}
