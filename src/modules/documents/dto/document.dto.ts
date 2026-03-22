import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({
    description: 'ID của Knowledge base để upload document vào',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  knowledge_id: string;

  @ApiPropertyOptional({
    description: 'Tên file (nếu không truyền sẽ lấy từ file upload)',
    example: 'tai-lieu-huong-dan.pdf',
  })
  @IsOptional()
  @IsString()
  file_name?: string;

  @ApiPropertyOptional({
    description: 'Loại document (auto-detected nếu không truyền)',
    example: 'pdf',
  })
  @IsOptional()
  @IsString()
  type?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({
    description: 'Tên file mới',
    example: 'tai-lieu-cap-nhat.pdf',
  })
  @IsOptional()
  @IsString()
  file_name?: string;
}

export class DocumentResponseDto {
  @ApiProperty({
    description: 'ID của document',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID của workspace',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  workspace_id: string;

  @ApiProperty({
    description: 'ID của user đã upload',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  user_id: string;

  @ApiProperty({
    description: 'Tên file',
    example: 'tai-lieu-huong-dan.pdf',
  })
  file_name: string;

  @ApiProperty({
    description: 'Tham chiếu storage của file',
    example: 'gs://my-chatbot-bucket/documents/workspace-id/abc123.pdf',
  })
  file_url: string;

  @ApiProperty({
    description: 'Loại file',
    example: 'pdf',
  })
  type: string;

  @ApiPropertyOptional({
    description: 'Kích thước file (bytes)',
    example: 1024000,
  })
  size?: number;

  @ApiPropertyOptional({
    description: 'Vector ID cho AI search',
    example: 'vec-123',
  })
  vector_id?: string;

  @ApiProperty({
    description: 'Thời gian upload',
    example: '2024-01-01T00:00:00.000Z',
  })
  uploaded_at: Date;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2024-01-01T00:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Thời gian cập nhật',
    example: '2024-01-01T00:00:00.000Z',
  })
  updated_at: Date;
}
