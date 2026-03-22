import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (expires in 15 minutes)',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token (expires in 7 days)',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE1MTYyMzkwMjJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'User id (để FE lưu và chuyển trang theo system_role)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Tên hiển thị',
    example: 'Nguyen Van A',
  })
  name: string;

  @ApiProperty({
    description: 'Email đăng nhập',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Vai trò hệ thống: "admin" hoặc "user". null nếu chưa gán. FE dùng để chuyển trang (admin vs user).',
    example: 'user',
    enum: ['admin', 'user'],
    nullable: true,
  })
  system_role: string | null;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'New JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;
}

export class ProfileResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Vai trò hệ thống: "admin" (quản trị viên) hoặc "user" (người dùng thường). null nếu chưa gán role.',
    example: 'user',
    enum: ['admin', 'user'],
    nullable: true,
  })
  system_role: string | null;
}
