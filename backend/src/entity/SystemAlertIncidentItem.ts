import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { SystemAlertRuleItem } from './SystemAlertRuleItem';

@Entity()
@Index({ properties: ['state', 'lastSeenAt'] })
export class SystemAlertIncidentItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ManyToOne(() => SystemAlertRuleItem)
  rule!: Rel<SystemAlertRuleItem>;

  @Property({ length: 320, index: true })
  fingerprint!: string;

  @Property({ length: 255, default: '' })
  dimensionKey = '';

  @Property({ length: 16, default: 'open' })
  state: 'open' | 'resolved' = 'open';

  @Property({ length: 16 })
  severity!: 'warning' | 'critical';

  @Property({ type: 'double' })
  observedValue!: number;

  @Property({ type: 'double' })
  threshold!: number;

  @Property({ type: 'integer', default: 0 })
  healthyEvaluations = 0;

  @Property({ length: 16, nullable: true })
  notifiedSeverity?: string | null;

  @Property({ type: 'datetime' })
  firstSeenAt: Date = new Date();

  @Property({ type: 'datetime', index: true })
  lastSeenAt: Date = new Date();

  @Property({ type: 'datetime', nullable: true })
  resolvedAt?: Date | null;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
