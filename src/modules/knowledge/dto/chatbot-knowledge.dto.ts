import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddKnowledgeToChatbotDto {
  @ApiProperty({ description: 'Knowledge base ID to add' })
  @IsUUID()
  knowledge_id: string;

  @ApiPropertyOptional({
    description: 'Priority (higher = searched first)',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({
    description: 'Enable/disable this knowledge for chatbot',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean;
}

export class UpdateChatbotKnowledgeDto {
  @ApiPropertyOptional({
    description: 'Enable/disable this knowledge for chatbot',
  })
  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Priority (higher = searched first)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}

export class BatchUpdateChatbotKnowledgeDto {
  @ApiProperty({
    description: 'Array of knowledge configs',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        knowledge_id: { type: 'string', format: 'uuid' },
        is_enabled: { type: 'boolean' },
        priority: { type: 'number' },
      },
    },
  })
  items: Array<{
    knowledge_id: string;
    is_enabled?: boolean;
    priority?: number;
  }>;
}
