import { type Rel } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityItem } from './EntityItem';
import { InboxSubscriptionItem } from './InboxSubscriptionItem';
import { InboxTemplateItem } from './InboxTemplateItem';
import { PersonItem } from './PersonItem';
import {
  Sapling,
  SaplingForm,
  SaplingGenericReference,
} from './global/entity.decorator';

@Entity()
export class InboxNotificationItem {
  @ApiProperty()
  @Sapling(['isOrderASC'])
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity'])
  @SaplingForm({
    order: 100,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => EntityItem, { nullable: false })
  entity!: Rel<EntityItem>;

  @ApiProperty({ type: () => InboxSubscriptionItem })
  @SaplingForm({
    order: 200,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => InboxSubscriptionItem, { nullable: false })
  subscription!: Rel<InboxSubscriptionItem>;

  @ApiPropertyOptional({ type: () => InboxTemplateItem })
  @SaplingForm({
    order: 300,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => InboxTemplateItem, { nullable: true })
  template?: Rel<InboxTemplateItem>;

  @ApiProperty({ type: () => PersonItem })
  @Sapling(['isPerson'])
  @SaplingForm({
    order: 400,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, {
    nullable: false,
    deleteRule: 'cascade',
  })
  recipientPerson!: Rel<PersonItem>;

  /**
   * First name of the person selected in recipientPerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 401,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 401,
    tableVisible: false,
    mobileOrder: 401,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get recipientPersonFirstName(): string | null | undefined {
    return this.recipientPerson?.firstName;
  }

  /**
   * Last name of the person selected in recipientPerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 402,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 402,
    tableVisible: false,
    mobileOrder: 402,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get recipientPersonLastName(): string | undefined {
    return this.recipientPerson?.lastName;
  }

  @ApiProperty({ type: () => PersonItem })
  @Sapling(['isPerson'])
  @SaplingForm({
    order: 500,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, {
    nullable: false,
    deleteRule: 'cascade',
  })
  createdBy!: Rel<PersonItem>;

  /**
   * First name of the person selected in createdBy.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 501,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 501,
    tableVisible: false,
    mobileOrder: 501,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get createdByFirstName(): string | null | undefined {
    return this.createdBy?.firstName;
  }

  /**
   * Last name of the person selected in createdBy.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 502,
    group: 'inboxNotification.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 502,
    tableVisible: false,
    mobileOrder: 502,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get createdByLastName(): string | undefined {
    return this.createdBy?.lastName;
  }

  @ApiPropertyOptional()
  @Sapling(['isSystem', 'isValue'])
  @SaplingGenericReference({
    entityField: 'entity',
    handleField: 'referenceHandle',
  })
  @SaplingForm({
    order: 100,
    group: 'inboxNotification.groupContent',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ nullable: true, length: 64 })
  referenceHandle?: string | null;

  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: true, length: 190, unique: true, hidden: true })
  automationDeduplicationKey?: string | null;

  @ApiProperty()
  @Sapling(['isValue'])
  @SaplingForm({
    order: 200,
    group: 'inboxNotification.groupContent',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ nullable: false, length: 256 })
  title!: string;

  @ApiProperty()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 300,
    group: 'inboxNotification.groupContent',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ nullable: false, length: 8192 })
  bodyMarkdown!: string;

  @ApiProperty()
  @SaplingForm({
    order: 400,
    group: 'inboxNotification.groupContent',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 400,
    tableVisible: false,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ nullable: false, length: 8192 })
  bodyText!: string;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 500,
    group: 'inboxNotification.groupContent',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 500,
    tableVisible: false,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ type: 'json', nullable: true })
  requestPayload?: object | null;

  @ApiPropertyOptional({ default: false })
  @SaplingForm({
    order: 100,
    group: 'inboxNotification.groupConfiguration',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ default: false, nullable: false })
  isRead: boolean = false;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @SaplingForm({
    order: 200,
    group: 'inboxNotification.groupConfiguration',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  readAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
