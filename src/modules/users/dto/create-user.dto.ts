import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Tên người dùng',
    example: 'Nguyễn Văn A',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email người dùng',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Mật khẩu (bắt buộc nếu không có google_id)',
    example: 'password123',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({
    description: 'Google ID (nếu đăng nhập qua Google)',
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  google_id?: string;

  @ApiPropertyOptional({
    description: 'URL avatar',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiPropertyOptional({
    description: 'Ngôn ngữ',
    example: 'vi',
    default: 'vi',
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
  system_role_id?: string;
}
