import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Tên người dùng',
    example: 'Nguyễn Văn B',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Email người dùng',
    example: 'newemail@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Mật khẩu mới',
    example: 'newpassword123',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    description: 'URL avatar',
    example: 'https://example.com/new-avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({
    description: 'Ngôn ngữ',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'ID của system role',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  system_role_id?: string | null;
}
