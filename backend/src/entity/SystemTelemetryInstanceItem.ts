import { Entity, Property } from '@mikro-orm/decorators/legacy';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
export class SystemTelemetryInstanceItem {
  @Property({ primary: true, length: 128 })
  handle!: string;

  @Sapling(['isReadOnly', 'isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'systemTelemetryInstance.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 255 })
  hostname!: string;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 200,
    group: 'systemTelemetryInstance.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 64, nullable: true })
  appVersion?: string | null;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 300,
    group: 'systemTelemetryInstance.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ type: 'datetime' })
  processStartedAt!: Date;

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @SaplingForm({
    order: 400,
    group: 'systemTelemetryInstance.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ type: 'datetime', nullable: true, index: true })
  lastSampleAt?: Date | null;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 500,
    group: 'systemTelemetryInstance.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ default: true })
  collectorEnabled = true;

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
