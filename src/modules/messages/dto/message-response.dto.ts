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

  /**
   * Chỉ có khi sender_type = 'bot': tổng token input/output của lượt chat (router + answer).
   * Dùng để hiển thị "X tokens" và nút "Details" xem chi tiết.
   */
  @ApiPropertyOptional({
    nullable: true,
    example: { input_tokens: 120, output_tokens: 45 },
  })
  token_usage: { input_tokens: number; output_tokens: number } | null;

  /**
   * Chỉ có khi sender_type = 'bot': danh sách tools đã gọi và kết quả.
   * Dùng để hiển thị "Y tools" và nút "Details" xem từng tool (tên, tham số, kết quả).
   */
  @ApiPropertyOptional({
    nullable: true,
    example: [
      {
        tool_name: 'knowledge_search',
        args: { query: 'chính sách đổi trả' },
        result: { answer: '...', sources: [] },
      },
    ],
  })
  tools_used: { tool_name: string; args: Record<string, any>; result: any }[] | null;
}

