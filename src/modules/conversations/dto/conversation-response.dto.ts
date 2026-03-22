import { ApiProperty } from '@nestjs/swagger';

export class ConversationResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  workspace_id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  user_id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  chatbot_id: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
  })
  started_at: Date;

  @ApiProperty({
    example: null,
    nullable: true,
  })
  ended_at: Date | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
  })
  updated_at: Date;
}
