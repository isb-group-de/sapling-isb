import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { SystemAlertRuleItem } from './SystemAlertRuleItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({ properties: ['state', 'lastSeenAt'] })
@Index({
  name: 'system_alert_incident_state_resolved_idx',
  properties: ['state', 'resolvedAt'],
})
export class SystemAlertIncidentItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 100,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => SystemAlertRuleItem)
  rule!: Rel<SystemAlertRuleItem>;

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 200,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ length: 320, index: true })
  fingerprint!: string;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 300,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ length: 255, default: '' })
  dimensionKey = '';

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 400,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ length: 16, default: 'open' })
  state: 'open' | 'resolved' = 'open';

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 500,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ length: 16 })
  severity!: 'warning' | 'critical';

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 600,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ type: 'double' })
  observedValue!: number;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 700,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ type: 'double' })
  threshold!: number;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 800,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 800,
    tableVisible: false,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 0 })
  healthyEvaluations = 0;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 900,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 900,
    tableVisible: false,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @Property({ length: 16, nullable: true })
  notifiedSeverity?: string | null;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 1000,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1000,
    tableVisible: true,
    mobileOrder: 1000,
    mobileVisible: false,
  })
  @Property({ type: 'datetime' })
  firstSeenAt: Date = new Date();

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @SaplingForm({
    order: 1100,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1100,
    tableVisible: true,
    mobileOrder: 1100,
    mobileVisible: false,
  })
  @Property({ type: 'datetime', index: true })
  lastSeenAt: Date = new Date();

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 1200,
    group: 'systemAlertIncident.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1200,
    tableVisible: true,
    mobileOrder: 1200,
    mobileVisible: false,
  })
  @Property({ type: 'datetime', nullable: true })
  resolvedAt?: Date | null;

  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Sapling(['isReadOnly', 'isSystem'])
  @Property({
    type: 'datetime',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
