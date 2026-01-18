import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'My Personal Assistant' })
  name: string;

  @ApiPropertyOptional({ example: 'Workspace cá nhân cho công việc hàng ngày' })
  description: string | null;

  @ApiProperty({ example: 'user-uuid-here' })
  owner_id: string;

  @ApiProperty({ example: false })
  is_personal: boolean;

  @ApiPropertyOptional({ example: '🚀' })
  icon: string | null;

  @ApiPropertyOptional({ example: '#3B82F6' })
  color: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiPropertyOptional({ 
    example: true,
    description: 'True if current user is the owner of this workspace'
  })
  is_owner?: boolean;

  @ApiPropertyOptional({ 
    example: 'Owner',
    description: 'Role of current user in this workspace (Owner, Admin, Editor, Viewer)'
  })
  user_role?: string;
}
