import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  user_id: string;

  @ApiProperty({ example: '100000.00' })
  amount: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: ['zalopay', 'momo', 'bank'] })
  provider: string;

  @ApiProperty({ example: 'TXN-2024-001' })
  transaction_id: string;

  @ApiProperty({ enum: ['pending', 'success', 'failed'] })
  status: string;

  @ApiProperty()
  created_at: Date;

  @ApiPropertyOptional()
  user?: { id: string; name: string; email: string };
}
