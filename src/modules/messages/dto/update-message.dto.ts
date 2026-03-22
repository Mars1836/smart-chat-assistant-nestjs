import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateMessageDto {
  @ApiPropertyOptional({
    description: 'Nội dung tin nhắn',
    example: 'Cập nhật nội dung tin nhắn',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({
    description: 'ID của intent',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  intent_id?: string | null;
}
