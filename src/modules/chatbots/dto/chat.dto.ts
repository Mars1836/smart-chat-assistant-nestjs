import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class ChatDto {
  @ApiProperty({
    description: 'Tin nhắn của user',
    example: 'Hôm nay thời tiết thế nào?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'ID của conversation (phải tạo trước qua API conversations)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  conversation_id: string;

  // Images will be populated by controller from multipart/form-data
  @IsOptional()
  images?: Express.Multer.File[];
}

export class UploadedImageDto {
  @ApiProperty({ description: 'ID của attachment' })
  id: string;

  @ApiProperty({ description: 'URL của ảnh', example: '/uploads/chat-images/workspace-id/image.jpg' })
  url: string;

  @ApiProperty({ description: 'Tên file', example: 'image.jpg' })
  filename: string;

  @ApiPropertyOptional({ description: 'MIME type', example: 'image/jpeg' })
  mime_type?: string;

  @ApiPropertyOptional({ description: 'Kích thước file (bytes)', example: 102400 })
  size?: number;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'ID của conversation',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  conversation_id: string;

  @ApiProperty({
    description: 'Response từ chatbot',
    example: 'Tôi xin lỗi, tôi không thể kiểm tra thời tiết...',
  })
  response: string;

  @ApiProperty({
    description: 'Model được sử dụng',
    example: 'gemini-1.5-flash',
  })
  model: string;

  @ApiProperty({ required: false, type: [Object], description: 'Files từ tools (bot response)' })
  files?: any[];

  @ApiProperty({ required: false, type: [UploadedImageDto], description: 'Ảnh user đã upload' })
  uploaded_images?: UploadedImageDto[];

  @ApiPropertyOptional({
    description: 'Cards chung (product | article | link): title, description?, imageUrl?, url (link khi bấm), metadata? (giá, brand, author, ...). FE render một kiểu card cho mọi type.',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['product', 'article', 'link'] },
        title: { type: 'string' },
        description: { type: 'string' },
        imageUrl: { type: 'string' },
        url: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
  })
  cards?: any[];

  @ApiProperty({
    description: 'Thời gian xử lý (ms)',
    example: 1234,
  })
  processingTime: number;
}
