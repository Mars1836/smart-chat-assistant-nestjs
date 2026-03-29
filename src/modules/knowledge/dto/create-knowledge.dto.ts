import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateKnowledgeDto {
  @ApiProperty({
    description: 'Name of the knowledge base',
    example: 'Product Documentation',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Description of the knowledge base' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier (emoji or icon name)',
    example: '📚',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;
}
