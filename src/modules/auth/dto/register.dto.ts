import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User full name',
    example: 'Nguyen Van A',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'User password (min 6 characters, must contain letter and number)',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;

  @ApiProperty({
    description: 'User language preference',
    example: 'vi',
    enum: ['vi', 'en'],
    default: 'vi',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiProperty({
    description: 'Client kind: web or mobile. Prefer header X-Client-Type.',
    enum: ['web', 'mobile'],
    required: false,
    default: 'web',
  })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client_type?: 'web' | 'mobile';
}
