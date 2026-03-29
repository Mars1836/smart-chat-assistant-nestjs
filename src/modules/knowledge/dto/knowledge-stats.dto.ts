import { ApiProperty } from '@nestjs/swagger';

export class KnowledgeStatsSummaryDto {
  @ApiProperty({ description: 'Tổng số knowledge base' })
  total_knowledge_bases: number;

  @ApiProperty({
    description: 'Tổng số document (tổng document_count của tất cả knowledge)',
  })
  total_documents: number;

  @ApiProperty({
    description: 'Tổng dung lượng (bytes) của tất cả document',
    example: '123456789',
  })
  total_size: string;

  @ApiProperty({
    description: 'Số knowledge base theo trạng thái',
    example: { active: 10, indexing: 2, error: 1 },
  })
  by_status: Record<string, number>;

  @ApiProperty({
    description: 'Số knowledge base tạo mới trong 7 ngày qua',
  })
  knowledge_last_7_days: number;

  @ApiProperty({
    description: 'Số knowledge base tạo mới trong 30 ngày qua',
  })
  knowledge_last_30_days: number;
}
