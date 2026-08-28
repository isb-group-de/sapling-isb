import { Collection, type Rel } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyItem } from './CompanyItem';
import { PersonItem } from './PersonItem';
import { SalesOpportunityItem } from './SalesOpportunityItem';
import { TicketItem } from './TicketItem';
import { EffortEstimatePositionItem } from './EffortEstimatePositionItem';
import { EffortEstimateStatusItem } from './EffortEstimateStatusItem';
import {
  Sapling,
  SaplingDependsOn,
  SaplingForm,
} from './global/entity.decorator';

@Entity()
export class EffortEstimateItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC', 'isDuplicateCheck'])
  @SaplingForm({
    order: 100,
    group: 'effortEstimate.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  title!: string;

  @ApiPropertyOptional({ type: () => EffortEstimateStatusItem })
  @Sapling(['isChip', 'isValue'])
  @SaplingForm({
    order: 200,
    group: 'effortEstimate.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @ManyToOne(() => EffortEstimateStatusItem, {
    nullable: true,
    deleteRule: 'set null',
  })
  status?: Rel<EffortEstimateStatusItem> | null;

  @ApiPropertyOptional({ type: 'string', format: 'date' })
  @Sapling(['isOrderASC', 'isDeadline'])
  @SaplingForm({
    order: 100,
    group: 'effortEstimate.groupSchedule',
    groupOrder: 250,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'date' })
  expectedCompletionDate?: Date;

  @ApiPropertyOptional()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 100,
    group: 'effortEstimate.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'text' })
  requirementsMarkdown?: string;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 100,
    group: 'effortEstimate.groupConfiguration',
    groupOrder: 500,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ default: true, nullable: false })
  isActive = true;

  @ApiPropertyOptional({ type: 'number' })
  @Sapling(['isReadOnly'])
  @Property({ persist: false, nullable: true, type: 'float' })
  get totalEstimatedHours(): number {
    if (!this.positions?.isInitialized()) {
      return 0;
    }

    return this.positions
      .getItems()
      .reduce((sum, position) => sum + (position.estimatedHours ?? 0), 0);
  }

  @ApiPropertyOptional({ type: () => CompanyItem })
  @Sapling(['isCompany', 'isCurrentCompany', 'isValue'])
  @SaplingForm({
    order: 100,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => CompanyItem, { nullable: true })
  assigneeCompany?: Rel<CompanyItem>;

  /**
   * Name of the company selected in assigneeCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 101,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: false,
    tableOrder: 101,
    tableVisible: false,
    mobileOrder: 101,
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
    order: 10000,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 10000,
    tableVisible: true,
    mobileOrder: 10000,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get assigneeCompanyEmail(): string | undefined {
    return this.assigneeCompany?.email;
  }

  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson', 'isPartner', 'isCurrentPerson'])
  @SaplingDependsOn({
    parentField: 'assigneeCompany',
    targetField: 'company',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 200,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
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
    order: 201,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 201,
    tableVisible: false,
    mobileOrder: 201,
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
    order: 202,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 202,
    tableVisible: false,
    mobileOrder: 202,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get assigneePersonLastName(): string | undefined {
    return this.assigneePerson?.lastName;
  }

  @ApiPropertyOptional({ type: () => CompanyItem })
  @Sapling(['isCompany', 'isCurrentCompany', 'isCustomer'])
  @SaplingForm({
    order: 300,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => CompanyItem, { nullable: true })
  creatorCompany?: Rel<CompanyItem>;

  /**
   * Name of the company selected in creatorCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 301,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: false,
    tableOrder: 301,
    tableVisible: false,
    mobileOrder: 301,
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
    order: 10001,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 10001,
    tableVisible: true,
    mobileOrder: 10001,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorCompanyEmail(): string | undefined {
    return this.creatorCompany?.email;
  }

  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson', 'isPartner', 'isCurrentPerson', 'isCustomer'])
  @SaplingDependsOn({
    parentField: 'creatorCompany',
    targetField: 'company',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 400,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: false,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  creatorPerson?: Rel<PersonItem>;

  /**
   * First name of the person selected in creatorPerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 401,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 401,
    tableVisible: false,
    mobileOrder: 401,
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
    order: 402,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 402,
    tableVisible: false,
    mobileOrder: 402,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorPersonLastName(): string | undefined {
    return this.creatorPerson?.lastName;
  }

  /**
   * Email address of the customer contact person.
   */
  @ApiPropertyOptional()
  @Sapling(['isMail', 'isReadOnly'])
  @SaplingForm({
    order: 403,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 403,
    tableVisible: true,
    mobileOrder: 403,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorPersonEmail(): string | undefined {
    return this.creatorPerson?.email;
  }

  /**
   * Phone number of the customer contact person.
   */
  @ApiPropertyOptional()
  @Sapling(['isPhone', 'isReadOnly'])
  @SaplingForm({
    order: 404,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 404,
    tableVisible: true,
    mobileOrder: 404,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get creatorPersonPhone(): string | undefined {
    return this.creatorPerson?.phone;
  }

  @ApiPropertyOptional({ type: () => SalesOpportunityItem })
  @SaplingForm({
    order: 500,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 500,
    tableVisible: false,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => SalesOpportunityItem, { nullable: true })
  salesOpportunity?: Rel<SalesOpportunityItem>;

  @ApiPropertyOptional({ type: () => TicketItem })
  @SaplingForm({
    order: 600,
    group: 'effortEstimate.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 600,
    tableVisible: false,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @ManyToOne(() => TicketItem, { nullable: true })
  ticket?: Rel<TicketItem>;

  @ApiPropertyOptional({
    type: () => EffortEstimatePositionItem,
    isArray: true,
  })
  @OneToMany(() => EffortEstimatePositionItem, (position) => position.estimate)
  positions: Collection<EffortEstimatePositionItem> =
    new Collection<EffortEstimatePositionItem>(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
