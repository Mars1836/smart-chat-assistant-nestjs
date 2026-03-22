import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationStarterDto } from '../../chatbots/dto/create-chatbot.dto';

export class WidgetPublicConfigDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  chatbot_id: string;

  @ApiProperty({
    example: 'My Assistant Bot',
  })
  name: string;

  @ApiPropertyOptional({
    example: 'Xin chao! Toi co the giup gi cho ban?',
    nullable: true,
  })
  greeting_message: string | null;

  @ApiPropertyOptional({
    description: 'UI config an toan de widget FE render',
    example: {
      position: 'bottom-right',
      primaryColor: '#4f46e5',
      title: 'Ho tro khach hang',
      greeting: 'Xin chao! Toi la chatbot cua workspace.',
    },
    nullable: true,
  })
  ui: Record<string, any> | null;

  @ApiProperty({
    type: [ConversationStarterDto],
  })
  conversation_starters: ConversationStarterDto[];
}
