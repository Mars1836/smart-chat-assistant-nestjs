import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description:
      'Client kind: web (refresh token via HttpOnly cookie) or mobile (refresh token in JSON). Prefer header X-Client-Type.',
    enum: ['web', 'mobile'],
    required: false,
    default: 'web',
  })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client_type?: 'web' | 'mobile';
}
