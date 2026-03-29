import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { WORKSPACE_ROLES } from '../../../common/constants/permissions.constant';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'Tên vai trò mới (Admin, Editor, Viewer)',
    example: 'Editor',
    enum: [
      WORKSPACE_ROLES.ADMIN,
      WORKSPACE_ROLES.EDITOR,
      WORKSPACE_ROLES.VIEWER,
    ],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn([WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.EDITOR, WORKSPACE_ROLES.VIEWER])
  role_name: string;
}
