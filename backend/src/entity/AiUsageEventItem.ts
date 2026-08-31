import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonItem } from './PersonItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({ properties: ['occurredAt', 'person'] })
@Index({ properties: ['provider', 'model', 'occurredAt'] })
@Index({ name: 'ai_usage_event_occurred_at_idx', properties: ['occurredAt'] })
export class AiUsageEventItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 100,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ length: 160, unique: true })
  sourceKey!: string;

  @Sapling(['isReadOnly', 'isPerson'])
  @SaplingForm({
    order: 200,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  person?: Rel<PersonItem> | null;

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 300,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 32 })
  operation!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 400,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ length: 24, default: 'interactive' })
  executionType = 'interactive';

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 500,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ length: 64, nullable: true })
  provider?: string | null;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 600,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ length: 128, nullable: true })
  model?: string | null;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 700,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ length: 24 })
  status!: string;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 800,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 800,
    tableVisible: true,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @Property({ type: 'integer', nullable: true })
  durationMs?: number | null;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 900,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 900,
    tableVisible: true,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @Property({ type: 'integer', nullable: true })
  inputTokens?: number | null;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1000,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1000,
    tableVisible: true,
    mobileOrder: 1000,
    mobileVisible: false,
  })
  @Property({ type: 'integer', nullable: true })
  outputTokens?: number | null;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1100,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1100,
    tableVisible: true,
    mobileOrder: 1100,
    mobileVisible: false,
  })
  @Property({ type: 'integer', nullable: true })
  totalTokens?: number | null;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 1200,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1200,
    tableVisible: false,
    mobileOrder: 1200,
    mobileVisible: false,
  })
  @Property({ default: false })
  usageReported = false;

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @SaplingForm({
    order: 1300,
    group: 'aiUsageEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1300,
    tableVisible: true,
    mobileOrder: 1300,
    mobileVisible: false,
  })
  @Property({ type: 'datetime', index: true })
  occurredAt!: Date;

  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
