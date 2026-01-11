import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdateConversationDto {
  @ApiPropertyOptional({
    description: 'Thời điểm kết thúc conversation',
    example: '2024-01-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  ended_at?: string | null;
}
