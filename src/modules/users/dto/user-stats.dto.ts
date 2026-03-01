import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsIn } from 'class-validator';

/** Response: thống kê tổng quan user */
export class UserStatsSummaryDto {
  @ApiProperty({ description: 'Tổng số user' })
  total: number;

  @ApiProperty({
    description: 'Số user theo vai trò',
    example: { admin: 2, user: 50, no_role: 3 },
  })
  by_role: Record<string, number>;

  @ApiProperty({ description: 'Số user mới đăng ký trong 7 ngày qua' })
  new_last_7_days: number;

  @ApiProperty({ description: 'Số user mới đăng ký trong 30 ngày qua' })
  new_last_30_days: number;
}

/** Query: thống kê user theo khoảng thời gian */
export class UserStatsByDateQueryDto {
  @ApiPropertyOptional({
    description: 'Từ ngày (ISO 8601). Mặc định: 30 ngày trước',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Đến ngày (ISO 8601). Mặc định: hôm nay',
    example: '2024-01-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Nhóm theo: day | week | month',
    enum: ['day', 'week', 'month'],
    default: 'day',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}

/** Một mục trong thống kê theo ngày */
export class UserStatsByDateItemDto {
  @ApiProperty({ description: 'Ngày/ tuần/ tháng (ISO date string)' })
  date: string;

  @ApiProperty({ description: 'Số user tạo trong kỳ' })
  count: number;
}
