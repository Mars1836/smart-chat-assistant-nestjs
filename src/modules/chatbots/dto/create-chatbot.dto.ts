import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConversationStarterDto {
  @ApiProperty({
    description: 'Nhãn ngắn hiển thị trên nút gợi ý',
    example: 'Giới thiệu',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label: string;

  @ApiProperty({
    description: 'Nội dung sẽ được gửi khi người dùng click starter',
    example: 'Hãy giới thiệu ngắn gọn bạn có thể hỗ trợ những gì.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;
}

export class CreateChatbotDto {
  @ApiProperty({
    description: 'Tên chatbot',
    example: 'My Assistant Bot',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Ngôn ngữ',
    example: 'vi',
    default: 'vi',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    description: 'Tính cách chatbot',
    example: 'Bạn là trợ lý thông minh, nhiệt tình và chuyên nghiệp',
  })
  @IsString()
  @IsOptional()
  personality?: string;

  @ApiPropertyOptional({
    description: 'Tin nhắn chào',
    example: 'Xin chào! Tôi có thể giúp gì cho bạn?',
  })
  @IsString()
  @IsOptional()
  greeting_message?: string;

  @ApiPropertyOptional({
    description: 'Tin nhắn khi không hiểu',
    example: 'Xin lỗi, tôi chưa hiểu. Bạn có thể nói rõ hơn?',
  })
  @IsString()
  @IsOptional()
  fallback_message?: string;

  @ApiPropertyOptional({
    description:
      'Danh sách gợi ý hội thoại đầu tiên để người dùng click khi bắt đầu conversation mới',
    type: [ConversationStarterDto],
    example: [
      {
        label: 'Giới thiệu',
        message: 'Hãy giới thiệu ngắn gọn bạn có thể hỗ trợ những gì.',
      },
      {
        label: 'Sản phẩm',
        message: 'Cho tôi biết các sản phẩm hoặc dịch vụ nổi bật hiện có.',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationStarterDto)
  conversation_starters?: ConversationStarterDto[];

  @ApiPropertyOptional({
    description: 'Ngưỡng confidence (0-1)',
    example: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  confidence_threshold?: number;

  @ApiPropertyOptional({
    description: 'Số lượt chat lưu context',
    example: 5,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  max_context_turns?: number;

  @ApiPropertyOptional({
    description: 'Cho phép học từ feedback',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  enable_learning?: boolean;

  @ApiPropertyOptional({
    description: 'LLM provider',
    example: 'google-ai-studio',
    default: 'google-ai-studio',
  })
  @IsString()
  @IsOptional()
  llm_provider?: string;

  @ApiPropertyOptional({
    description: 'LLM model',
    example: 'gemini-2.0-flash-lite',
    default: 'gemini-2.0-flash-lite',
  })
  @IsString()
  @IsOptional()
  llm_model?: string;

  @ApiPropertyOptional({
    description: 'Temperature (0-1)',
    example: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Max tokens',
    example: 1000,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  max_tokens?: number;

  @ApiPropertyOptional({
    description:
      'Cấu hình widget cho website embed (enabled, position, màu sắc, domain, ...)',
    example: {
      enabled: true,
      position: 'bottom-right',
      primaryColor: '#4f46e5',
      title: 'Hỗ trợ khách hàng',
      greeting: 'Xin chào! Tôi là chatbot của workspace.',
      allowedOrigins: ['https://example.com'],
      lang: 'vi',
    },
  })
  @IsOptional()
  widget_config?: Record<string, any>;
}
