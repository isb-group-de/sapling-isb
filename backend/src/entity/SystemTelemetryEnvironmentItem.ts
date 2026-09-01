import { Entity, Property } from '@mikro-orm/decorators/legacy';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
export class SystemTelemetryEnvironmentItem {
  @Sapling(['isReadOnly', 'isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
  })
  @Property({ primary: true, length: 96 })
  handle!: string;

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 200,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
  })
  @Property({ length: 128 })
  name!: string;

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 300,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
  })
  @Property({ length: 24 })
  kind!: 'production' | 'test' | 'development' | 'imported';

  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 400,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
  })
  @Property({ default: false })
  isArchived = false;

  @Sapling(['isReadOnly'])
  @Property({ type: 'datetime' })
  firstSeenAt: Date = new Date();

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @Property({ type: 'datetime', index: true })
  lastSeenAt: Date = new Date();
}
