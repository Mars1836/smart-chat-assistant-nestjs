import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    description: 'ID của workspace',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  workspace_id: string;

  @ApiProperty({
    description: 'ID của chatbot',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  @IsNotEmpty()
  chatbot_id: string;
}
