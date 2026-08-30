import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonApiTokenItem } from './PersonApiTokenItem';
import { PersonItem } from './PersonItem';

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
export class HttpMetricBucketItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Property({ type: 'datetime', index: true })
  bucketStart!: Date;

  @Property({ length: 8, default: '1m' })
  resolution: '1m' | '15m' | '1h' = '1m';

  @Property({ length: 64 })
  attributionKey!: string;

  @ManyToOne(() => PersonItem, { nullable: true })
  person?: Rel<PersonItem> | null;

  @ManyToOne(() => PersonApiTokenItem, { nullable: true })
  apiToken?: Rel<PersonApiTokenItem> | null;

  @Property({ length: 16 })
  authKind!: 'session' | 'apiToken' | 'anonymous' | 'system';

  @Property({ length: 32 })
  routeGroup!: string;

  @Property({ type: 'integer', default: 0 })
  requestCount = 0;

  @Property({ type: 'integer', default: 0 })
  clientErrorCount = 0;

  @Property({ type: 'integer', default: 0 })
  serverErrorCount = 0;

  @Property({ type: 'bigint', default: 0 })
  requestBytes: string | number = 0;

  @Property({ type: 'bigint', default: 0 })
  responseBytes: string | number = 0;

  @Property({ type: 'double', default: 0 })
  durationSumMs = 0;

  @Property({ type: 'double', default: 0 })
  durationMaxMs = 0;

  @Property({ type: 'json' })
  durationHistogram: number[] = Array.from({ length: 10 }, () => 0);

  @Property({ type: 'integer', default: 0 })
  impersonatedCount = 0;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
