import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonApiTokenItem } from './PersonApiTokenItem';
import { PersonItem } from './PersonItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({
  name: 'http_metric_bucket_unique',
  properties: [
    'bucketStart',
    'resolution',
    'attributionKey',
    'routeGroup',
    'authKind',
  ],
  options: { unique: true },
})
@Index({ properties: ['bucketStart', 'person'] })
@Index({
  name: 'http_metric_bucket_resolution_time_idx',
  properties: ['resolution', 'bucketStart'],
})
@Index({
  name: 'http_metric_bucket_person_resolution_time_idx',
  properties: ['person', 'resolution', 'bucketStart'],
})
export class HttpMetricBucketItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @SaplingForm({
    order: 100,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ type: 'datetime', index: true })
  bucketStart!: Date;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 200,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 8, default: '1m' })
  resolution: '1m' | '15m' | '1h' = '1m';

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 300,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 64 })
  attributionKey!: string;

  @Sapling(['isReadOnly', 'isPerson'])
  @SaplingForm({
    order: 400,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  person?: Rel<PersonItem> | null;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 500,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonApiTokenItem, { nullable: true })
  apiToken?: Rel<PersonApiTokenItem> | null;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 600,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ length: 16 })
  authKind!: 'session' | 'apiToken' | 'anonymous' | 'system';

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 700,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ length: 32 })
  routeGroup!: string;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 800,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 800,
    tableVisible: true,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 0 })
  requestCount = 0;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 900,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 900,
    tableVisible: true,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 0 })
  clientErrorCount = 0;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1000,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1000,
    tableVisible: true,
    mobileOrder: 1000,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 0 })
  serverErrorCount = 0;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1100,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1100,
    tableVisible: false,
    mobileOrder: 1100,
    mobileVisible: false,
  })
  @Property({ type: 'bigint', default: 0 })
  requestBytes: string | number = 0;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1200,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1200,
    tableVisible: false,
    mobileOrder: 1200,
    mobileVisible: false,
  })
  @Property({ type: 'bigint', default: 0 })
  responseBytes: string | number = 0;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1300,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1300,
    tableVisible: true,
    mobileOrder: 1300,
    mobileVisible: false,
  })
  @Property({ type: 'double', default: 0 })
  durationSumMs = 0;

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1400,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1400,
    tableVisible: true,
    mobileOrder: 1400,
    mobileVisible: false,
  })
  @Property({ type: 'double', default: 0 })
  durationMaxMs = 0;

  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 1500,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 1500,
    tableVisible: false,
    mobileOrder: 1500,
    mobileVisible: false,
  })
  @Property({ type: 'json' })
  durationHistogram: number[] = Array.from({ length: 10 }, () => 0);

  @Sapling(['isReadOnly', 'isNumeric'])
  @SaplingForm({
    order: 1600,
    group: 'httpMetricBucket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 1600,
    tableVisible: false,
    mobileOrder: 1600,
    mobileVisible: false,
  })
  @Property({ type: 'integer', default: 0 })
  impersonatedCount = 0;

  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
