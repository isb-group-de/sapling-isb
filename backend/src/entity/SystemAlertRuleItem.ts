import { Entity, Property } from '@mikro-orm/decorators/legacy';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
export class SystemAlertRuleItem {
  @Property({ primary: true, length: 64 })
  handle!: string;

  @Sapling(['isReadOnly', 'isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 128 })
  title!: string;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 200,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 96 })
  metricKey!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 300,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ length: 16, default: 'warning' })
  severity: 'warning' | 'critical' = 'warning';

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 400,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ length: 8, default: 'gt' })
  comparator: 'gt' | 'gte' | 'lt' | 'lte' = 'gt';

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 500,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ type: 'double' })
  threshold!: number;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 600,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 300 })
  windowSeconds = 300;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 700,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 700,
    tableVisible: false,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 1 })
  minimumCount = 1;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 800,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 800,
    tableVisible: false,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @Property({ length: 16, default: 'global' })
  scope = 'global';

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 900,
    group: 'systemAlertRule.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 900,
    tableVisible: true,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @Property({ default: true })
  isActive = true;

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
