import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Email của tài khoản cần đổi mật khẩu',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mật khẩu mới (min 8 ký tự, ít nhất 1 chữ và 1 số)',
    example: 'NewPassword123',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  newPassword: string;
}
