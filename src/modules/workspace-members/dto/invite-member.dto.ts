import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email của người dùng cần mời',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: `Tên role sẽ gán cho thành viên. Roles có thể sử dụng:
- **Owner** (level 100): Chủ workspace - Toàn quyền (bao gồm xóa workspace)
- **Admin** (level 50): Quản trị viên - Tất cả permissions trừ xóa workspace
- **Editor** (level 20): Biên tập viên - Quản lý chatbot và documents
- **Viewer** (level 10): Người xem - Chỉ xem chatbot, chat và documents

⚠️ Lưu ý: Tên role phân biệt chữ hoa/thường`,
    example: 'Editor',
    enum: ['Owner', 'Admin', 'Editor', 'Viewer'],
  })
  @IsString()
  role_name: string;
}
