import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({
    description:
      'Optional: mobile clients send refresh token to revoke (server-side revoke when implemented)',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiProperty({
    description: 'Optional explicit client type if header is not sent',
    enum: ['web', 'mobile'],
    required: false,
  })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  client_type?: 'web' | 'mobile';
}
