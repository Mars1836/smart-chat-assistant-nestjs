import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsIn,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    description: 'ID của conversation',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  conversation_id: string;

  @ApiProperty({
    description: 'Loại người gửi',
    enum: ['user', 'bot'],
    example: 'user',
  })
  @IsIn(['user', 'bot'])
  @IsNotEmpty()
  sender_type: 'user' | 'bot';

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Xin chào! Bạn có thể giúp tôi không?',
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({
    description: 'ID của intent (nếu có)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  intent_id?: string;
}
