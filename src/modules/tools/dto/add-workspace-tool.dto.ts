import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class AddWorkspaceToolDto {
  @IsUUID()
  @IsNotEmpty()
  tool_id: string;

  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean = true;

  @IsObject()
  @IsOptional()
  config_override?: Record<string, any>;
}
