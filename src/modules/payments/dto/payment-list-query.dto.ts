import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, IsIn, IsUUID } from 'class-validator';

export class PaymentListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: ['created_at', 'amount'] })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ enum: ['pending', 'success', 'failed'] })
  @IsOptional()
  @IsIn(['pending', 'success', 'failed'])
  status?: 'pending' | 'success' | 'failed';

  @ApiPropertyOptional({ enum: ['zalopay', 'momo', 'bank'] })
  @IsOptional()
  @IsIn(['zalopay', 'momo', 'bank'])
  provider?: 'zalopay' | 'momo' | 'bank';

  /** Chỉ admin: lọc theo user_id */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  user_id?: string;
}
