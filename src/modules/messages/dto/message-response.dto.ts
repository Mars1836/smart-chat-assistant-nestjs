import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  conversation_id: string;

  @ApiProperty({
    enum: ['user', 'bot'],
    example: 'user',
  })
  sender_type: 'user' | 'bot';

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  sender_id: string | null;

  @ApiProperty({
    example: 'Xin chào! Bạn có thể giúp tôi không?',
  })
  content: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  intent_id: string | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
  })
  updated_at: Date;
}

