import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity({ name: 'intents' })
export class Intent extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'float' })
  confidence: number;

  @Column({ type: 'jsonb' })
  entities: Record<string, unknown>;
}
