import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonItem } from './PersonItem';

@Entity()
@Index({ properties: ['occurredAt', 'person'] })
@Index({ properties: ['provider', 'model', 'occurredAt'] })
export class AiUsageEventItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Property({ length: 160, unique: true })
  sourceKey!: string;

  @ManyToOne(() => PersonItem, { nullable: true })
  person?: Rel<PersonItem> | null;

  @Property({ length: 32 })
  operation!: string;

  @Property({ length: 24, default: 'interactive' })
  executionType = 'interactive';

  @Property({ length: 64, nullable: true })
  provider?: string | null;

  @Property({ length: 128, nullable: true })
  model?: string | null;

  @Property({ length: 24 })
  status!: string;

  @Property({ type: 'integer', nullable: true })
  durationMs?: number | null;

  @Property({ type: 'integer', nullable: true })
  inputTokens?: number | null;

  @Property({ type: 'integer', nullable: true })
  outputTokens?: number | null;

  @Property({ type: 'integer', nullable: true })
  totalTokens?: number | null;

  @Property({ default: false })
  usageReported = false;

  @Property({ type: 'datetime', index: true })
  occurredAt!: Date;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
