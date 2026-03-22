import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLlmModelDto {
  @ApiProperty({ example: 'gemini', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  provider: string;

  @ApiProperty({ example: 'gemini-2.0-flash-lite', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  model: string;

  @ApiProperty({ example: 0.0005, description: 'Giá per 1K input tokens (credits)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_per_1k_input_tokens: number;

  @ApiProperty({ example: 0.0015, description: 'Giá per 1K output tokens (credits)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_per_1k_output_tokens: number;

  @ApiPropertyOptional({ example: 'Gemini 2.0 Flash Lite', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  display_name?: string | null;
}

export class UpdateLlmModelDto {
  @ApiPropertyOptional({ example: 0.0005 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_per_1k_input_tokens?: number;

  @ApiPropertyOptional({ example: 0.0015 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_per_1k_output_tokens?: number;

  @ApiPropertyOptional({ example: 'Gemini 2.0 Flash Lite', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  display_name?: string | null;
}
