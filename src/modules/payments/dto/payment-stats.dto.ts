import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsIn, IsUUID } from 'class-validator';

export class PaymentStatsSummaryDto {
  @ApiProperty({ description: 'Tổng số giao dịch' })
  total_count: number;

  @ApiProperty({ description: 'Tổng tiền (số tiền thành công)' })
  total_amount_success: string;

  @ApiProperty({
    description: 'Số giao dịch theo trạng thái',
    example: { pending: 2, success: 50, failed: 3 },
  })
  by_status: Record<string, number>;

  @ApiProperty({
    description: 'Số giao dịch theo kênh',
    example: { zalopay: 10, momo: 20, bank: 25 },
  })
  by_provider: Record<string, number>;

  @ApiProperty({ description: 'Số giao dịch thành công 7 ngày qua' })
  success_last_7_days: number;

  @ApiProperty({ description: 'Số giao dịch thành công 30 ngày qua' })
  success_last_30_days: number;
}

export class PaymentStatsByDateQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';

  /** Chỉ admin: thống kê theo user_id; bỏ trống = toàn hệ thống */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  user_id?: string;
}

export class PaymentStatsByDateItemDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  count: number;

  @ApiProperty({ description: 'Tổng tiền trong kỳ (giao dịch success)' })
  amount: string;
}
