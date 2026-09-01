import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { SystemTelemetryEnvironmentItem } from './SystemTelemetryEnvironmentItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({ properties: ['environment', 'checkKey', 'startedAt'] })
export class SystemCheckRunItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => SystemTelemetryEnvironmentItem)
  environment!: Rel<SystemTelemetryEnvironmentItem>;

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
  })
  @Property({ length: 96 })
  checkKey!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @Property({ length: 32 })
  category!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @Property({ length: 16 })
  status!: 'healthy' | 'warning' | 'critical';

  @Sapling(['isReadOnly', 'isNumeric'])
  @Property({ type: 'integer' })
  durationMs!: number;

  @Sapling(['isReadOnly'])
  @Property({ length: 500, nullable: true })
  summary?: string | null;

  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'json', nullable: true })
  steps?: Array<Record<string, unknown>> | null;

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @Property({ type: 'datetime', index: true })
  startedAt: Date = new Date();

  @Sapling(['isReadOnly'])
  @Property({ type: 'datetime' })
  completedAt: Date = new Date();
}
