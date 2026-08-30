import { Entity, Property } from '@mikro-orm/decorators/legacy';

@Entity()
export class SystemAlertRuleItem {
  @Property({ primary: true, length: 64 })
  handle!: string;

  @Property({ length: 128 })
  title!: string;

  @Property({ length: 96 })
  metricKey!: string;

  @Property({ length: 16, default: 'warning' })
  severity: 'warning' | 'critical' = 'warning';

  @Property({ length: 8, default: 'gt' })
  comparator: 'gt' | 'gte' | 'lt' | 'lte' = 'gt';

  @Property({ type: 'double' })
  threshold!: number;

  @Property({ type: 'integer', default: 300 })
  windowSeconds = 300;

  @Property({ type: 'integer', default: 1 })
  minimumCount = 1;

  @Property({ length: 16, default: 'global' })
  scope = 'global';

  @Property({ default: true })
  isActive = true;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
