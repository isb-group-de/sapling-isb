import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { SystemTelemetryInstanceItem } from './SystemTelemetryInstanceItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

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

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 100,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => SystemTelemetryInstanceItem)
  instance!: Rel<SystemTelemetryInstanceItem>;

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @SaplingForm({
    order: 200,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ type: 'datetime', index: true })
  bucketStart!: Date;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 300,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ length: 8 })
  resolution!: '10s' | '1m' | '15m' | '1h';

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 400,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: true,
  })
  @Property({ length: 96 })
  metricKey!: string;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 500,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ length: 255, default: '' })
  dimensionKey = '';

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 600,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 1 })
  sampleCount = 1;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 700,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ type: 'double' })
  minimum!: number;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 800,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 800,
    tableVisible: true,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @Property({ type: 'double' })
  maximum!: number;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 900,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 900,
    tableVisible: false,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @Property({ type: 'double' })
  sum!: number;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1000,
    group: 'systemMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1000,
    tableVisible: true,
    mobileOrder: 1000,
    mobileVisible: false,
  })
  @Property({ type: 'double' })
  last!: number;

  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
