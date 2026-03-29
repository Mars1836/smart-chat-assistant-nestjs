import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceStatsSummaryDto {
  @ApiProperty({ description: 'Tổng số workspace' })
  total_workspaces: number;

  @ApiProperty({
    description: 'Tổng số chatbot trong toàn hệ thống',
  })
  total_chatbots: number;

  @ApiProperty({
    description: 'Số chatbot trung bình trên mỗi workspace',
    example: 1.5,
  })
  avg_chatbots_per_workspace: number;

  @ApiProperty({
    description: 'Số workspace được tạo trong 7 ngày qua',
  })
  workspaces_last_7_days: number;

  @ApiProperty({
    description: 'Số workspace được tạo trong 30 ngày qua',
  })
  workspaces_last_30_days: number;

  @ApiProperty({
    description: 'Số chatbot được tạo trong 7 ngày qua',
  })
  chatbots_last_7_days: number;

  @ApiProperty({
    description: 'Số chatbot được tạo trong 30 ngày qua',
  })
  chatbots_last_30_days: number;
}
