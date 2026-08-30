import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonItem } from './PersonItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({ properties: ['person', 'occurredAt'] })
export class AuthenticationEventItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isReadOnly', 'isPerson'])
  @SaplingForm({
    order: 100,
    group: 'authenticationEvent.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  person?: Rel<PersonItem> | null;

  @Sapling(['isReadOnly', 'isValue', 'isChip'])
  @SaplingForm({
    order: 200,
    group: 'authenticationEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ length: 32 })
  eventType!: 'loginSuccess' | 'loginFailure' | 'logout';

  @Sapling(['isReadOnly', 'isChip'])
  @SaplingForm({
    order: 300,
    group: 'authenticationEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ length: 24 })
  provider!: 'local' | 'passkey' | 'azure' | 'google' | 'unknown';

  @Sapling(['isReadOnly', 'isOrderDESC'])
  @SaplingForm({
    order: 400,
    group: 'authenticationEvent.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ type: 'datetime', index: true })
  occurredAt: Date = new Date();
}
