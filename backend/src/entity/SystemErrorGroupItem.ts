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
@Index({
  name: 'system_error_group_environment_fingerprint_unique',
  properties: ['environment', 'fingerprint'],
  options: { unique: true },
})
@Index({ properties: ['status', 'lastSeenAt'] })
export class SystemErrorGroupItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => SystemTelemetryEnvironmentItem)
  environment!: Rel<SystemTelemetryEnvironmentItem>;

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 100,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
  })
  @Property({ length: 64 })
  fingerprint!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 200,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
  })
  @Property({ length: 24 })
  source!: string;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 300,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
  })
  @Property({ length: 160 })
  operation!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @Property({ length: 16, default: 'open' })
  status: 'open' | 'resolved' | 'ignored' = 'open';

  @Sapling(['isReadOnly', 'isNumeric'])
  @Property({ type: 'integer', default: 1 })
  occurrenceCount = 1;

  @Sapling(['isReadOnly'])
  @Property({ length: 128, nullable: true })
  latestRelease?: string | null;

  @Sapling(['isReadOnly'])
  @Property({ type: 'datetime' })
  firstSeenAt: Date = new Date();

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @Property({ type: 'datetime', index: true })
  lastSeenAt: Date = new Date();
}
