import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { SystemTelemetryInstanceItem } from './SystemTelemetryInstanceItem';

@Entity()
@Index({
  name: 'system_metric_bucket_unique',
  properties: [
    'instance',
    'bucketStart',
    'resolution',
    'metricKey',
    'dimensionKey',
  ],
  options: { unique: true },
})
@Index({ properties: ['metricKey', 'resolution', 'bucketStart'] })
export class SystemMetricBucketItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ManyToOne(() => SystemTelemetryInstanceItem)
  instance!: Rel<SystemTelemetryInstanceItem>;

  @Property({ type: 'datetime', index: true })
  bucketStart!: Date;

  @Property({ length: 8 })
  resolution!: '10s' | '1m' | '15m' | '1h';

  @Property({ length: 96 })
  metricKey!: string;

  @Property({ length: 255, default: '' })
  dimensionKey = '';

  @Property({ type: 'integer', default: 1 })
  sampleCount = 1;

  @Property({ type: 'double' })
  minimum!: number;

  @Property({ type: 'double' })
  maximum!: number;

  @Property({ type: 'double' })
  sum!: number;

  @Property({ type: 'double' })
  last!: number;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
