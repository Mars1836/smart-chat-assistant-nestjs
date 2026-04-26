import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class TextToSpeechDto {
  @ApiProperty({
    description: 'Nội dung văn bản cần chuyển thành giọng nói',
    example: 'Xin chào, tôi là trợ lý nội quy công ty.',
  })
  @IsString()
  text: string;

  @ApiPropertyOptional({
    description: 'Tên voice Gemini TTS (nếu provider hỗ trợ)',
    example: 'Kore',
    default: 'Kore',
  })
  @IsOptional()
  @IsString()
  voice?: string;

  @ApiPropertyOptional({
    description: 'Tốc độ đọc (0.5 - 2.0), 1.0 là bình thường',
    example: 1,
    minimum: 0.5,
    maximum: 2,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speaking_rate?: number;
}

