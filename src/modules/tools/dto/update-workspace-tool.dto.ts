import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateWorkspaceToolDto {
  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean;

  @IsObject()
  @IsOptional()
  config_override?: Record<string, any>;
}
