import { type Rel } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiAgentItem } from './AiAgentItem';
import { EmailInboxProcessingModeItem } from './EmailInboxProcessingModeItem';
import { PersonItem } from './PersonItem';
import { SharedMailboxItem } from './SharedMailboxItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

export type EmailInboxProcessingMode =
  'ticket' | 'salesOpportunity' | 'officeTask';

@Entity()
export class EmailInboxSubscriptionItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'emailInboxSubscription.groupBasics',
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

  @ApiProperty({ type: () => SharedMailboxItem })
  @SaplingForm({
    order: 100,
    group: 'emailInboxSubscription.groupReference',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => SharedMailboxItem, { nullable: false })
  mailbox!: Rel<SharedMailboxItem>;

  @ApiProperty({ type: () => PersonItem })
  @Sapling(['isPerson'])
  @SaplingForm({
    order: 200,
    group: 'emailInboxSubscription.groupReference',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: false })
  processingPerson!: Rel<PersonItem>;

  @ApiPropertyOptional({ type: () => AiAgentItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 300,
    group: 'emailInboxSubscription.groupReference',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => AiAgentItem, { nullable: true })
  agent?: Rel<AiAgentItem> | null;

  @ApiProperty({ type: () => EmailInboxProcessingModeItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 100,
    group: 'emailInboxSubscription.groupProcessing',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => EmailInboxProcessingModeItem, { nullable: false })
  processingMode!: Rel<EmailInboxProcessingModeItem>;

  @ApiPropertyOptional()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 200,
    group: 'emailInboxSubscription.groupProcessing',
    groupOrder: 300,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ type: 'text', nullable: true })
  contextMarkdown?: string | null;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 300,
    group: 'emailInboxSubscription.groupProcessing',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ default: true, nullable: false })
  automaticProcessing = true;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 100,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ default: true, nullable: false })
  isActive = true;

  @ApiPropertyOptional({ default: 1 })
  @Sapling(['isNumeric'])
  @SaplingForm({
    order: 200,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ default: 1, nullable: false })
  intervalMinutes = 1;

  @ApiPropertyOptional({ default: false })
  @SaplingForm({
    order: 300,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ default: false, nullable: false })
  importExistingOnFirstRun = false;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 400,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  lastRunAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 500,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  lastSuccessAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 600,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  lastReceivedAt?: Date | null;

  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 700,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 4,
    visible: true,
    tableOrder: 700,
    tableVisible: false,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ length: 1024, nullable: true })
  lastError?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @Sapling(['isReadOnly', 'isSystem', 'isNumeric'])
  @SaplingForm({
    order: 800,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 800,
    tableVisible: true,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @Property({ default: 0, nullable: false })
  importedCount = 0;

  @ApiPropertyOptional({ default: 0 })
  @Sapling(['isReadOnly', 'isSystem', 'isNumeric'])
  @SaplingForm({
    order: 900,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 900,
    tableVisible: true,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @Property({ default: 0, nullable: false })
  processedCount = 0;

  @ApiPropertyOptional({ default: 0 })
  @Sapling(['isReadOnly', 'isSystem', 'isNumeric'])
  @SaplingForm({
    order: 1000,
    group: 'emailInboxSubscription.groupSchedule',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 1000,
    tableVisible: true,
    mobileOrder: 1000,
    mobileVisible: false,
  })
  @Property({ default: 0, nullable: false })
  manualReviewCount = 0;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
