import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiAgentItem } from './AiAgentItem';
import { AiChatMessageItem } from './AiChatMessageItem';
import { AiChatSessionItem } from './AiChatSessionItem';
import { CompanyItem } from './CompanyItem';
import { DocumentItem } from './DocumentItem';
import { EmailInboxSubscriptionItem } from './EmailInboxSubscriptionItem';
import { EventItem } from './EventItem';
import { InboundEmailStatusItem } from './InboundEmailStatusItem';
import { PersonItem } from './PersonItem';
import { SalesOpportunityItem } from './SalesOpportunityItem';
import { SharedMailboxItem } from './SharedMailboxItem';
import { TicketItem } from './TicketItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

export type InboundEmailLogEntry = {
  at: string;
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

@Entity()
@Unique({ properties: ['mailbox', 'providerMessageId'] })
export class InboundEmailItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => InboundEmailStatusItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 100,
    group: 'inboundEmail.groupStatus',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => InboundEmailStatusItem, {
    defaultRaw: `'pending'`,
    nullable: false,
  })
  status!: Rel<InboundEmailStatusItem>;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderDESC'])
  @SaplingForm({
    order: 100,
    group: 'inboundEmail.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 512, nullable: false })
  subject!: string;

  @ApiProperty()
  @Sapling(['isMail'])
  @SaplingForm({
    order: 200,
    group: 'inboundEmail.groupContent',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ length: 320, nullable: false })
  fromAddress!: string;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 300,
    group: 'inboundEmail.groupContent',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ length: 256, nullable: true })
  fromName?: string | null;

  @ApiProperty({ type: [String] })
  @Property({ type: 'json', nullable: false })
  toRecipients: string[] = [];

  @ApiPropertyOptional({ type: [String] })
  @Property({ type: 'json', nullable: true })
  ccRecipients?: string[] | null;

  @ApiPropertyOptional()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 400,
    group: 'inboundEmail.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 400,
    tableVisible: false,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ type: 'text', nullable: true })
  bodyText?: string | null;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 500,
    group: 'inboundEmail.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 500,
    tableVisible: false,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ type: 'text', nullable: true })
  bodyHtml?: string | null;

  @ApiProperty({ type: () => SharedMailboxItem })
  @SaplingForm({
    order: 100,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => SharedMailboxItem, { nullable: false })
  mailbox!: Rel<SharedMailboxItem>;

  @ApiProperty({ type: () => EmailInboxSubscriptionItem })
  @SaplingForm({
    order: 200,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => EmailInboxSubscriptionItem, { nullable: false })
  subscription!: Rel<EmailInboxSubscriptionItem>;

  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson', 'isCustomer'])
  @SaplingForm({
    order: 300,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  person?: Rel<PersonItem> | null;

  @ApiPropertyOptional({ type: () => CompanyItem })
  @Sapling(['isCompany', 'isCustomer'])
  @SaplingForm({
    order: 400,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => CompanyItem, { nullable: true })
  company?: Rel<CompanyItem> | null;

  @ApiPropertyOptional({ type: () => TicketItem })
  @SaplingForm({
    order: 500,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => TicketItem, { nullable: true })
  ticket?: Rel<TicketItem> | null;

  @ApiPropertyOptional({ type: () => SalesOpportunityItem })
  @SaplingForm({
    order: 600,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @ManyToOne(() => SalesOpportunityItem, { nullable: true })
  salesOpportunity?: Rel<SalesOpportunityItem> | null;

  @ApiPropertyOptional({ type: () => EventItem })
  @SaplingForm({
    order: 700,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @ManyToOne(() => EventItem, { nullable: true })
  officeTask?: Rel<EventItem> | null;

  @ApiPropertyOptional({ type: () => DocumentItem })
  @SaplingForm({
    order: 800,
    group: 'inboundEmail.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 800,
    tableVisible: true,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @ManyToOne(() => DocumentItem, { nullable: true, unique: true })
  sourceDocument?: Rel<DocumentItem> | null;

  @ApiProperty()
  @Sapling(['isChip'])
  @Property({ length: 32, nullable: false })
  provider!: string;

  @ApiProperty()
  @Sapling(['isSystem'])
  @Property({ length: 512, nullable: false })
  providerMessageId!: string;

  @ApiPropertyOptional()
  @Sapling(['isSystem'])
  @Property({ length: 512, nullable: true })
  internetMessageId?: string | null;

  @ApiPropertyOptional()
  @Sapling(['isSystem'])
  @Property({ length: 512, nullable: true })
  conversationId?: string | null;

  @ApiPropertyOptional()
  @Sapling(['isSystem'])
  @Property({ length: 512, nullable: true })
  inReplyTo?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @Sapling(['isSystem'])
  @Property({ type: 'json', nullable: true })
  references?: string[] | null;

  @ApiPropertyOptional()
  @Sapling(['isSystem'])
  @Property({ type: 'json', nullable: true })
  headers?: Record<string, string | string[]> | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  @SaplingForm({
    order: 100,
    group: 'inboundEmail.groupSchedule',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ nullable: false, type: 'datetime' })
  receivedAt!: Date;

  @ApiPropertyOptional({ default: 0 })
  @Sapling(['isReadOnly', 'isSystem', 'isNumeric'])
  @SaplingForm({
    order: 100,
    group: 'inboundEmail.groupProcessing',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ default: 0, nullable: false })
  processingAttempts = 0;

  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 200,
    group: 'inboundEmail.groupProcessing',
    groupOrder: 500,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ length: 1024, nullable: true })
  processingMessage?: string | null;

  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 300,
    group: 'inboundEmail.groupProcessing',
    groupOrder: 500,
    width: 4,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ type: 'json', nullable: true })
  processingLog?: InboundEmailLogEntry[] | null;

  @ApiPropertyOptional({ type: () => AiAgentItem })
  @SaplingForm({
    order: 400,
    group: 'inboundEmail.groupProcessing',
    groupOrder: 500,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => AiAgentItem, { nullable: true })
  agent?: Rel<AiAgentItem> | null;

  @ApiPropertyOptional({ type: () => AiChatSessionItem })
  @SaplingForm({
    order: 500,
    group: 'inboundEmail.groupProcessing',
    groupOrder: 500,
    width: 2,
    visible: true,
    tableOrder: 500,
    tableVisible: false,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => AiChatSessionItem, { nullable: true })
  aiSession?: Rel<AiChatSessionItem> | null;

  @ApiPropertyOptional({ type: () => AiChatMessageItem })
  @SaplingForm({
    order: 600,
    group: 'inboundEmail.groupProcessing',
    groupOrder: 500,
    width: 2,
    visible: true,
    tableOrder: 600,
    tableVisible: false,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @ManyToOne(() => AiChatMessageItem, { nullable: true })
  aiMessage?: Rel<AiChatMessageItem> | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 700,
    group: 'inboundEmail.groupProcessing',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  processedAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
