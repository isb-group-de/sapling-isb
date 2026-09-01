import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { SystemErrorGroupItem } from './SystemErrorGroupItem';
import { SystemTelemetryEnvironmentItem } from './SystemTelemetryEnvironmentItem';
import { SystemTelemetryInstanceItem } from './SystemTelemetryInstanceItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({ properties: ['group', 'occurredAt'] })
@Index({ properties: ['environment', 'occurredAt'] })
export class SystemErrorOccurrenceItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => SystemErrorGroupItem)
  group!: Rel<SystemErrorGroupItem>;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => SystemTelemetryEnvironmentItem)
  environment!: Rel<SystemTelemetryEnvironmentItem>;

  @Sapling(['isReadOnly'])
  @ManyToOne(() => SystemTelemetryInstanceItem, { nullable: true })
  instance?: Rel<SystemTelemetryInstanceItem> | null;

  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
  })
  @Property({ length: 160 })
  operation!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @Property({ length: 24 })
  source!: string;

  @Sapling(['isReadOnly'])
  @Property({ length: 128 })
  errorClass!: string;

  @Sapling(['isReadOnly'])
  @Property({ length: 64, nullable: true })
  errorCode?: string | null;

  @Sapling(['isReadOnly'])
  @Property({ length: 500 })
  message!: string;

  @Sapling(['isReadOnly', 'isMarkdown'])
  @Property({ type: 'text', nullable: true })
  stack?: string | null;

  @Sapling(['isReadOnly'])
  @Property({ length: 64, nullable: true, index: true })
  requestId?: string | null;

  @Sapling(['isReadOnly'])
  @Property({ length: 64, nullable: true, index: true })
  correlationId?: string | null;

  @Sapling(['isReadOnly'])
  @Property({ length: 128, nullable: true })
  release?: string | null;

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @Property({ type: 'datetime', index: true })
  occurredAt: Date = new Date();
}
