import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonItem } from './PersonItem';
import { SystemAlertIncidentItem } from './SystemAlertIncidentItem';
import { SystemTelemetryEnvironmentItem } from './SystemTelemetryEnvironmentItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({ properties: ['environment', 'startedAt'] })
export class SystemRemediationExecutionItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => SystemTelemetryEnvironmentItem)
  environment!: Rel<SystemTelemetryEnvironmentItem>;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => SystemAlertIncidentItem, { nullable: true })
  incident?: Rel<SystemAlertIncidentItem> | null;

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
  })
  @Property({ length: 96 })
  actionKey!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @Property({ length: 16 })
  mode!: 'automatic' | 'approved';

  @Sapling(['isReadOnly', 'isChip'])
  @Property({ length: 24 })
  state!: 'running' | 'succeeded' | 'failed' | 'denied';

  @Sapling(['isReadOnly', 'isNumeric'])
  @Property({ type: 'integer', default: 1 })
  attempt = 1;

  @Sapling(['isReadOnly'])
  @Property({ length: 128, unique: true })
  idempotencyKey!: string;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => PersonItem, { nullable: true })
  approvedBy?: Rel<PersonItem> | null;

  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'json', nullable: true })
  evidence?: Record<string, unknown> | null;

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @Property({ type: 'datetime', index: true })
  startedAt: Date = new Date();

  @Sapling(['isReadOnly'])
  @Property({ type: 'datetime', nullable: true })
  completedAt?: Date | null;
}
