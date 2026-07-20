import {
  Entity,
  ManyToOne,
  OneToMany,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Collection, type Rel } from '@mikro-orm/core';
import { EntityItem } from './EntityItem';
import { EmailSubscriptionConditionItem } from './EmailSubscriptionConditionItem';
import { EmailTemplateItem } from './EmailTemplateItem';
import { PersonItem } from './PersonItem';
import { SharedMailboxItem } from './SharedMailboxItem';
import { WebhookSubscriptionTypeItem } from './WebhookSubscriptionTypeItem';
import {
  Sapling,
  SaplingDependsOn,
  SaplingForm,
  SaplingInlineCollection,
} from './global/entity.decorator';

@Entity()
export class EmailSubscriptionItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'emailSubscription.groupContent',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  description!: string;

  @ApiProperty()
  @SaplingForm({
    order: 200,
    group: 'emailSubscription.groupContent',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 128, nullable: false })
  recipientField!: string;

  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson'])
  @SaplingForm({
    order: 300,
    group: 'emailSubscription.groupContent',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: false })
  senderPerson!: Rel<PersonItem>;

  @ApiPropertyOptional({ type: () => SharedMailboxItem })
  @SaplingForm({
    order: 400,
    group: 'emailSubscription.groupContent',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: false,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => SharedMailboxItem, { nullable: true })
  senderMailbox?: Rel<SharedMailboxItem>;

  @ApiPropertyOptional({
    type: () => EmailSubscriptionConditionItem,
    isArray: true,
    description:
      'Conditions that must match before an automatic email is sent. Empty means always.',
  })
  @SaplingInlineCollection({
    renderer: 'conditionBuilder',
    sourceEntityField: 'entity',
  })
  @SaplingForm({
    order: 100,
    group: 'emailSubscription.groupCondition',
    groupOrder: 250,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @OneToMany(
    () => EmailSubscriptionConditionItem,
    (condition) => condition.subscription,
    { orphanRemoval: true },
  )
  conditions = new Collection<EmailSubscriptionConditionItem>(this);

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 100,
    group: 'emailSubscription.groupConfiguration',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ default: true, nullable: false })
  isActive: boolean = true;

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity'])
  @SaplingForm({
    order: 150,
    group: 'emailSubscription.groupContent',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 150,
    tableVisible: true,
    mobileOrder: 150,
    mobileVisible: false,
  })
  @ManyToOne(() => EntityItem, { nullable: false })
  entity!: Rel<EntityItem>;

  @ApiProperty({ type: () => WebhookSubscriptionTypeItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 200,
    group: 'emailSubscription.groupReference',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => WebhookSubscriptionTypeItem, {
    defaultRaw: `'afterInsert'`,
    nullable: false,
  })
  type!: Rel<WebhookSubscriptionTypeItem>;

  @ApiProperty({ type: () => EmailTemplateItem })
  @SaplingDependsOn({
    parentField: 'entity',
    targetField: 'entity',
    requireParent: true,
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 300,
    group: 'emailSubscription.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => EmailTemplateItem, { nullable: false })
  template!: Rel<EmailTemplateItem>;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
