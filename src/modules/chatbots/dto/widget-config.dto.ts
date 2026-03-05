import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateWidgetSecurityConfigDto {
  @ApiPropertyOptional({
    description: 'Bật/tắt widget public cho chatbot này',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Danh sách origin được phép embed / gọi widget. Hỗ trợ wildcard đơn giản, ví dụ: ["https://shop1.com", "https://*.mydomain.com"]. Nếu để trống => cho phép mọi origin.',
    type: [String],
    example: ['https://shop1.com', 'https://*.mydomain.com'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowed_origins?: string[];

  @ApiPropertyOptional({
    description:
      'Whitelist IP (optional). Nếu có giá trị thì chỉ cho phép IP trong danh sách gọi widget.',
    type: [String],
    example: ['1.2.3.4'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowed_ips?: string[] | null;

  @ApiPropertyOptional({
    description:
      'Public API key cho widget. Nếu set giá trị, FE bắt buộc phải gửi header `X-Widget-Key` với đúng key này.',
    example: 'pub_widget_xxx',
  })
  @IsString()
  @IsOptional()
  public_api_key?: string | null;

  @ApiPropertyOptional({
    description: 'Thời gian window rate limit (giây)',
    example: 60,
    minimum: 1,
    default: 60,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  rate_limit_window_sec?: number;

  @ApiPropertyOptional({
    description: 'Số request tối đa trong mỗi window',
    example: 30,
    minimum: 1,
    default: 30,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  rate_limit_max_requests?: number;
}

export class UpdateWidgetConfigDto {
  @ApiPropertyOptional({
    description:
      'Cấu hình UI cho widget (màu sắc, vị trí, tiêu đề, ...). Tùy FE/BE định nghĩa chi tiết.',
    example: {
      position: 'bottom-right',
      primaryColor: '#4f46e5',
      title: 'Hỗ trợ khách hàng',
      greeting: 'Xin chào! Tôi là chatbot của workspace.',
    },
  })
  @IsOptional()
  ui?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Cấu hình bảo mật cho widget (whitelist domain/IP, API key, rate limit).',
    type: () => UpdateWidgetSecurityConfigDto,
  })
  @IsOptional()
  security?: UpdateWidgetSecurityConfigDto;
}

