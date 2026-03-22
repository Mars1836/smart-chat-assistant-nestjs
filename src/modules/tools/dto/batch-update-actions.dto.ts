import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchUpdateActionItemDto {
  @IsString()
  action_id: string;

  @IsBoolean()
  is_enabled: boolean;

  @IsObject()
  @IsOptional()
  config_override?: Record<string, any>;
}

export class BatchUpdateActionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchUpdateActionItemDto)
  actions: BatchUpdateActionItemDto[];
}
