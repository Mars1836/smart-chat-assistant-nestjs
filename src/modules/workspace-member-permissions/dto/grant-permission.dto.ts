import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export class GrantPermissionDto {
  @ApiProperty({
    example: 'member.invite',
    description: 'Name of the permission to grant or revoke',
  })
  @IsString()
  @IsNotEmpty()
  permission_name: string;

  @ApiProperty({
    example: 'grant',
    enum: ['grant', 'revoke'],
    description: 'Action to perform: grant (allow) or revoke (deny)',
  })
  @IsEnum(['grant', 'revoke'])
  action: 'grant' | 'revoke';
}
