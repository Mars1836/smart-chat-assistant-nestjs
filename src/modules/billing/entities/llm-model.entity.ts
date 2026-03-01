import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'llm_models' })
@Unique(['provider', 'model'])
export class LlmModel extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 120 })
  model: string;

  @Column({ type: 'decimal', precision: 12, scale: 6, default: 0 })
  price_per_1k_input_tokens: string;

  @Column({ type: 'decimal', precision: 12, scale: 6, default: 0 })
  price_per_1k_output_tokens: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  display_name: string | null;
}
