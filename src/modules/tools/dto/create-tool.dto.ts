import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateToolActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  display_name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsObject()
  @IsOptional()
  parameters?: Record<string, any> = {};

  @IsObject()
  @IsOptional()
  executor_config?: Record<string, any> | null;

  @IsInt()
  @IsOptional()
  sort_order?: number = 0;

  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean = true;

  /** Đánh dấu action trả về list → hiển thị card. enabled, list_path, field_mapping (title/url/imageUrl/description) */
  @IsObject()
  @IsOptional()
  card_config?: {
    enabled?: boolean;
    list_path?: string;
    field_mapping?: Record<string, string>;
  } | null;
}

export class CreateToolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  display_name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsIn(['builtin', 'custom', 'community'])
  @IsOptional()
  category?: 'builtin' | 'custom' | 'community' = 'custom';

  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean = true;

  @IsIn(['generic_api', 'http_api', 'function', 'rag', 'oauth_api', 'database'])
  executor_type:
    | 'generic_api'
    | 'http_api'
    | 'function'
    | 'rag'
    | 'oauth_api'
    | 'database';

  @IsObject()
  @IsOptional()
  executor_config?: Record<string, any> = {};

  @IsObject()
  @IsOptional()
  auth_config?: Record<string, any> | null;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  icon_url?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateToolActionDto)
  @IsOptional()
  actions?: CreateToolActionDto[] = [];
}
