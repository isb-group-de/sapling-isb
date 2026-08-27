import { Collection } from '@mikro-orm/core';
import {
  Entity,
  OneToMany,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonItem } from './PersonItem';
import { TicketStatusItem } from './TicketStatusItem';
import { TicketPriorityItem } from './TicketPriorityItem';
import { TicketTimeTrackingItem } from './TicketTimeTracking';
import {
  Sapling,
  SaplingDependsOn,
  SaplingForm,
  SaplingKanban,
} from './global/entity.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventItem } from './EventItem';
import { SalesOpportunityItem } from './SalesOpportunityItem';
import { type Rel } from '@mikro-orm/core';
import { CompanyItem } from './CompanyItem';
import { ContractItem } from './ContractItem';
import { SlaPolicyItem } from './SlaPolicyItem';
import { SupportQueueItem } from './SupportQueueItem';
import { SupportTeamItem } from './SupportTeamItem';
import { TicketCategoryItem } from './TicketCategoryItem';
import { TicketSourceItem } from './TicketSourceItem';
import { TicketTypeItem } from './TicketTypeItem';
import { EffortEstimateItem } from './EffortEstimateItem';

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Entity representing a support or service ticket, including persisted properties, relations, and system fields.
 *
 * @property        {number}                handle              Unique identifier for the ticket (primary key)
 * @property        {string}                number              Ticket number or short summary (optional)
 * @property        {string}                externalNumber      External number or reference for the ticket (optional)
 * @property        {string}                title               Title or short summary of the ticket
 * @property        {string}                problemDescription  Detailed description of the problem (optional, markdown)
 * @property        {string}                solutionDescription Detailed description of the solution (optional, markdown)
 * @property        {Date}                  startDate           Start date of the ticket
 * @property        {Date}                  endDate             End date of the ticket (optional)
 * @property        {Date}                  deadlineDate        Deadline date for the ticket (optional)
 * @property        {PersonItem}            assignee            The person assigned to this ticket
 * @property        {PersonItem}            creator             The person who created the ticket
 * @property        {TicketStatusItem}      status              The current status of the ticket
 * @property        {TicketPriorityItem}    priority            The priority assigned to the ticket
 * @property        {SalesOpportunityItem}  salesOpportunity    Sales Opportunity related to this ticket (optional)
 * @property        {Collection<TicketTimeTrackingItem>} timeTrackings Time tracking entries for this ticket
 * @property        {Collection<EventItem>} events              Event entries for this ticket
 * @property        {Date}                  createdAt           Date and time when the ticket was created
 * @property        {Date}                  updatedAt           Date and time when the ticket was last updated
 */
@Entity()
export class TicketItem {
  // #region Group: Basics
  /**
   * Ticket number or short summary (optional).
   * @type {string}
   */
  @ApiPropertyOptional()
  @Sapling(['isValue', 'isReadOnly', 'isDuplicateCheck'])
  @SaplingKanban({
    columnField: 'status',
    scopeOpenField: 'isOpen',
    scopeOpenValue: true,
    cardSubtitleFields: ['assigneeCompany', 'creatorCompany'],
    cardMetaFields: ['priority', 'type'],
    cardFooterFields: ['assigneePerson', 'creatorPerson', 'deadlineDate'],
  })
  @SaplingForm({
    order: 100,
    group: 'ticket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 32, nullable: true })
  number!: string;

  /**
   * Title or short summary of the ticket.
   * @type {string}
   */
  @ApiProperty()
  @Sapling(['isValue', 'isDuplicateCheck'])
  @SaplingForm({
    order: 300,
    group: 'ticket.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  title!: string;

  /**
   * The current status of the ticket.
   * @type {TicketStatusItem}
   */
  @ApiPropertyOptional({ type: () => TicketStatusItem })
  @Sapling(['isChip', 'isValue'])
  @SaplingForm({
    order: 400,
    group: 'ticket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: true,
  })
  @ManyToOne(() => TicketStatusItem, {
    nullable: true,
    default: 'open',
    deleteRule: 'set null',
  })
  status?: TicketStatusItem | null;

  /**
   * The priority assigned to the ticket.
   * @type {TicketPriorityItem}
   */
  @ApiPropertyOptional({ type: () => TicketPriorityItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 500,
    group: 'ticket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => TicketPriorityItem, {
    nullable: true,
    default: 'normal',
    deleteRule: 'set null',
  })
  priority?: TicketPriorityItem | null;

  /**
   * External number or reference for the ticket (optional).
   * @type {string}
   */
  @ApiProperty()
  @Sapling(['isDuplicateCheck'])
  @SaplingForm({
    order: 200,
    group: 'ticket.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 128, nullable: true })
  externalNumber?: string;
  // #endregion

  // #region Group: Content
  /**
   * Detailed description of the problem (optional, markdown).
   * @type {string}
   */
  @ApiPropertyOptional()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 100,
    group: 'ticket.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'text' })
  problemDescription?: string;

  /**
   * Detailed description of the solution (optional, markdown).
   * @type {string}
   */
  @ApiPropertyOptional()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 200,
    group: 'ticket.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'text' })
  solutionDescription?: string;
  // #endregion

  // #region Group: Schedule
  /**
   * Start date of the ticket.
   * @type {Date}
   */
  @ApiProperty({ type: 'string', format: 'date-time' })
  @Sapling(['isToday', 'isDateStart'])
  @SaplingForm({
    order: 100,
    group: 'ticket.groupSchedule',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ nullable: false, type: 'datetime' })
  startDate!: Date;

  /**
   * End date of the ticket (optional).
   * @type {Date}
   */
  @ApiProperty({ type: 'string', format: 'date-time' })
  @Sapling(['isDateEnd'])
  @SaplingForm({
    order: 200,
    group: 'ticket.groupSchedule',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  endDate!: Date;

  /**
   * Deadline date for the ticket (optional).
   * @type {Date}
   */
  @ApiProperty({ type: 'string', format: 'date-time' })
  @Sapling(['isOrderASC', 'isDeadline'])
  @SaplingForm({
    order: 300,
    group: 'ticket.groupSchedule',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  deadlineDate!: Date;
  // #endregion

  // #region Group: Reference
  /**
   * The company assigned to this ticket.
   * @type {CompanyItem}
   */
  @ApiPropertyOptional({ type: () => CompanyItem })
  @Sapling(['isCompany', 'isCurrentCompany'])
  @SaplingForm({
    order: 300,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => CompanyItem, { nullable: true })
  assigneeCompany?: Rel<CompanyItem>;

  /**
   * Name of the company selected in assigneeCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 301,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: false,
    tableOrder: 301,
    tableVisible: false,
    mobileOrder: 301,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get assigneeCompanyName(): string | undefined {
    return this.assigneeCompany?.name;
  }

  /**
   * Email address of the company selected in assigneeCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isMail', 'isReadOnly'])
  @SaplingForm({
    order: 302,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 302,
    tableVisible: true,
    mobileOrder: 302,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get assigneeCompanyEmail(): string | undefined {
    return this.assigneeCompany?.email;
  }

  /**
   * The person assigned to this ticket.
   * @type {PersonItem}
   */
  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson', 'isPartner', 'isCurrentPerson'])
  @SaplingDependsOn({
    parentField: 'assigneeCompany',
    targetField: 'company',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 600,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  assigneePerson?: Rel<PersonItem>;

  /**
   * First name of the person selected in assigneePerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 601,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 1,
    visible: false,
    tableOrder: 601,
    tableVisible: false,
    mobileOrder: 601,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get assigneePersonFirstName(): string | null | undefined {
    return this.assigneePerson?.firstName;
  }

  /**
   * Last name of the person selected in assigneePerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 602,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 1,
    visible: false,
    tableOrder: 602,
    tableVisible: false,
    mobileOrder: 602,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get assigneePersonLastName(): string | undefined {
    return this.assigneePerson?.lastName;
  }

  /**
   * The company that created the ticket.
   * @type {CompanyItem}
   */
  @ApiPropertyOptional({ type: () => CompanyItem })
  @Sapling(['isCompany', 'isCurrentCompany', 'isCustomer'])
  @SaplingForm({
    order: 700,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 700,
    tableVisible: false,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @ManyToOne(() => CompanyItem, { nullable: false })
  creatorCompany?: Rel<CompanyItem>;

  /**
   * Name of the company selected in creatorCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 701,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: false,
    tableOrder: 701,
    tableVisible: false,
    mobileOrder: 701,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorCompanyName(): string | undefined {
    return this.creatorCompany?.name;
  }

  /**
   * Email address of the company selected in creatorCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isMail', 'isReadOnly'])
  @SaplingForm({
    order: 702,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 702,
    tableVisible: true,
    mobileOrder: 702,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorCompanyEmail(): string | undefined {
    return this.creatorCompany?.email;
  }

  /**
   * The person who created the ticket.
   * @type {PersonItem}
   */
  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson', 'isPartner', 'isCurrentPerson', 'isCustomer'])
  @SaplingDependsOn({
    parentField: 'creatorCompany',
    targetField: 'company',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 800,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 800,
    tableVisible: false,
    mobileOrder: 800,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: false })
  creatorPerson?: Rel<PersonItem>;

  /**
   * First name of the person selected in creatorPerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 801,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 1,
    visible: false,
    tableOrder: 801,
    tableVisible: false,
    mobileOrder: 801,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorPersonFirstName(): string | null | undefined {
    return this.creatorPerson?.firstName;
  }

  /**
   * Last name of the person selected in creatorPerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 802,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 1,
    visible: false,
    tableOrder: 802,
    tableVisible: false,
    mobileOrder: 802,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorPersonLastName(): string | undefined {
    return this.creatorPerson?.lastName;
  }

  /**
   * Sales Opportunity related to this ticket (optional).
   * @type {SalesOpportunityItem}
   */
  @ApiPropertyOptional({ type: () => SalesOpportunityItem })
  @SaplingForm({
    order: 900,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 900,
    tableVisible: false,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @ManyToOne(() => SalesOpportunityItem, { nullable: true })
  salesOpportunity?: SalesOpportunityItem;
  // #endregion

  // #region Group: SLA
  /**
   * Active SLA policy used to calculate deadlines for this ticket.
   * @type {SlaPolicyItem}
   */
  @ApiPropertyOptional({ type: () => SlaPolicyItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 100,
    group: 'ticket.groupSla',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => SlaPolicyItem, { nullable: true })
  slaPolicy?: Rel<SlaPolicyItem>;

  /**
   * Deadline for the first response.
   * @type {Date}
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isDeadline'])
  @SaplingForm({
    order: 200,
    group: 'ticket.groupSla',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  firstResponseDueAt?: Date;

  /**
   * Deadline for the overall solution.
   * @type {Date}
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isDeadline'])
  @SaplingForm({
    order: 300,
    group: 'ticket.groupSla',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  resolutionDueAt?: Date;

  /**
   * Actual timestamp of the first response.
   * @type {Date}
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isDateStart'])
  @SaplingForm({
    order: 400,
    group: 'ticket.groupSla',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: false,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  firstRespondedAt?: Date;

  /**
   * Actual timestamp at which the ticket was resolved.
   * @type {Date}
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isDateEnd'])
  @SaplingForm({
    order: 500,
    group: 'ticket.groupSla',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: false,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  resolvedAt?: Date;
  // #endregion

  // #region Group: Support
  /**
   * The support process type of the ticket.
   * @type {TicketTypeItem}
   */
  @ApiPropertyOptional({ type: () => TicketTypeItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 100,
    group: 'ticket.groupSupport',
    groupOrder: 450,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => TicketTypeItem, { default: 'incident', nullable: false })
  type!: Rel<TicketTypeItem>;

  /**
   * Optional ticket category within the selected ticket type.
   * @type {TicketCategoryItem}
   */
  @ApiPropertyOptional({ type: () => TicketCategoryItem })
  @Sapling(['isChip'])
  @SaplingDependsOn({
    parentField: 'type',
    targetField: 'type',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 200,
    group: 'ticket.groupSupport',
    groupOrder: 450,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => TicketCategoryItem, { nullable: true })
  category?: Rel<TicketCategoryItem>;

  /**
   * Inbound source from which the ticket entered the support process.
   * @type {TicketSourceItem}
   */
  @ApiPropertyOptional({ type: () => TicketSourceItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 300,
    group: 'ticket.groupSupport',
    groupOrder: 450,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => TicketSourceItem, { default: 'email', nullable: false })
  source!: Rel<TicketSourceItem>;

  /**
   * Support team currently responsible for the ticket.
   * @type {SupportTeamItem}
   */
  @ApiPropertyOptional({ type: () => SupportTeamItem })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 400,
    group: 'ticket.groupSupport',
    groupOrder: 450,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => SupportTeamItem, { nullable: true })
  supportTeam?: Rel<SupportTeamItem>;

  /**
   * Support queue currently responsible for the ticket.
   * @type {SupportQueueItem}
   */
  @ApiPropertyOptional({ type: () => SupportQueueItem })
  @Sapling(['isChip'])
  @SaplingDependsOn({
    parentField: 'supportTeam',
    targetField: 'team',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 500,
    group: 'ticket.groupSupport',
    groupOrder: 450,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => SupportQueueItem, { nullable: true })
  supportQueue?: Rel<SupportQueueItem>;

  /**
   * Contract that governs the support case.
   * @type {ContractItem}
   */
  @ApiPropertyOptional({ type: () => ContractItem })
  @SaplingDependsOn({
    parentField: 'creatorCompany',
    targetField: 'company',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 50,
    group: 'ticket.groupSupport',
    groupOrder: 450,
    width: 1,
    visible: true,
    tableOrder: 50,
    tableVisible: false,
    mobileOrder: 50,
    mobileVisible: false,
  })
  @ManyToOne(() => ContractItem, { nullable: true })
  contract?: Rel<ContractItem>;
  // #endregion

  // #region Without group
  /**
   * Unique identifier for the ticket (primary key).
   * @type {number}
   */
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  /**
   * Email address of the person who created the ticket.
   * @type {string}
   */
  @ApiPropertyOptional()
  @Sapling(['isMail', 'isReadOnly'])
  @SaplingForm({
    order: 803,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 803,
    tableVisible: true,
    mobileOrder: 803,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorPersonEmail(): string | undefined {
    return this.creatorPerson?.email;
  }

  /**
   * Phone number of the person who created the ticket.
   * @type {string}
   */
  @ApiPropertyOptional()
  @Sapling(['isPhone', 'isReadOnly'])
  @SaplingForm({
    order: 804,
    group: 'ticket.groupReference',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 804,
    tableVisible: true,
    mobileOrder: 804,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorPersonPhone(): string | undefined {
    return this.creatorPerson?.phone;
  }

  /**
   * Time tracking entries for this ticket.
   * @type {Collection<TicketTimeTrackingItem>}
   */
  @ApiPropertyOptional({ type: () => TicketTimeTrackingItem, isArray: true })
  @OneToMany(() => TicketTimeTrackingItem, (x) => x.ticket)
  timeTrackings: Collection<TicketTimeTrackingItem> =
    new Collection<TicketTimeTrackingItem>(this);

  /**
   * Event entries for this ticket.
   * @type {Collection<EventItem>}
   */
  @ApiPropertyOptional({ type: () => EventItem, isArray: true })
  @OneToMany(() => EventItem, (x) => x.ticket)
  events: Collection<EventItem> = new Collection<EventItem>(this);

  /**
   * Effort estimates related to this ticket.
   * @type {Collection<EffortEstimateItem>}
   */
  @ApiPropertyOptional({ type: () => EffortEstimateItem, isArray: true })
  @OneToMany(() => EffortEstimateItem, (x) => x.ticket)
  effortEstimates: Collection<EffortEstimateItem> =
    new Collection<EffortEstimateItem>(this);

  /**
   * Date and time when the ticket was created.
   * @type {Date}
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  /**
   * Date and time when the ticket was last updated.
   * @type {Date}
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
  // #endregion
}
