import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({
    description: 'Tên workspace',
    example: 'My Personal Assistant',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Mô tả workspace',
    example: 'Workspace cá nhân cho công việc hàng ngày',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Workspace cá nhân hay nhóm',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_personal?: boolean;

  @ApiPropertyOptional({
    description: 'Icon/emoji cho workspace',
    example: '🚀',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Màu đại diện (hex code)',
    example: '#3B82F6',
  })
  @IsString()
  @IsOptional()
  @MaxLength(7)
  color?: string;
}
