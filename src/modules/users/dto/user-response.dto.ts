import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
  })
  name: string;

  @ApiProperty({
    example: 'user@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatar_url: string | null;

  @ApiProperty({
    example: 'vi',
    default: 'vi',
  })
  language: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  system_role_id: string | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
  })
  updated_at: Date;
}
