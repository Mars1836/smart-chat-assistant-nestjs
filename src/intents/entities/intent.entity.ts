import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'intents' })
export class Intent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'float' })
  confidence: number;

  @Column({ type: 'jsonb' })
  entities: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
