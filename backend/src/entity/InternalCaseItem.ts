import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { type Rel } from '@mikro-orm/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyItem } from './CompanyItem';
import { PersonItem } from './PersonItem';
import { InternalCaseStatusItem } from './InternalCaseStatusItem';
import { InternalCaseCategoryItem } from './InternalCaseCategoryItem';
import {
  Sapling,
  SaplingDependsOn,
  SaplingForm,
  SaplingKanban,
} from './global/entity.decorator';

@Entity()
export class InternalCaseItem {
  @ApiPropertyOptional()
  @Sapling(['isValue', 'isReadOnly', 'isDuplicateCheck'])
  @SaplingKanban({
    columnField: 'status',
    scopeOpenField: 'isOpen',
    scopeOpenValue: true,
    cardSubtitleFields: ['customerCompany', 'responsibleCompany'],
    cardMetaFields: ['category'],
    cardFooterFields: ['customerPerson', 'responsiblePerson', 'updatedAt'],
  })
  @SaplingForm({
    order: 100,
    group: 'internalCase.groupBasics',
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

  @ApiProperty()
  @Sapling(['isValue', 'isDuplicateCheck'])
  @SaplingForm({
    order: 200,
    group: 'internalCase.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  title!: string;

  @ApiPropertyOptional({ type: () => InternalCaseStatusItem })
  @Sapling(['isChip', 'isValue'])
  @SaplingForm({
    order: 300,
    group: 'internalCase.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @ManyToOne(() => InternalCaseStatusItem, {
    nullable: true,
    deleteRule: 'set null',
  })
  status?: Rel<InternalCaseStatusItem> | null;

  @ApiPropertyOptional({
    type: () => InternalCaseCategoryItem,
    default: 'internalRequest',
  })
  @Sapling(['isChip'])
  @SaplingForm({
    order: 400,
    group: 'internalCase.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => InternalCaseCategoryItem, {
    default: 'internalRequest',
    nullable: false,
  })
  category!: Rel<InternalCaseCategoryItem>;

  @ApiPropertyOptional()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 100,
    group: 'internalCase.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'text' })
  requestMarkdown?: string;

  @ApiPropertyOptional()
  @Sapling(['isMarkdown'])
  @SaplingForm({
    order: 200,
    group: 'internalCase.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'text' })
  internalInformationMarkdown?: string;

  @ApiPropertyOptional({ type: () => CompanyItem })
  @Sapling(['isCompany', 'isValue'])
  @SaplingForm({
    order: 100,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => CompanyItem, { nullable: true })
  customerCompany?: Rel<CompanyItem>;

  /**
   * Name of the company selected in customerCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 101,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 2,
    visible: false,
    tableOrder: 101,
    tableVisible: false,
    mobileOrder: 101,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get customerCompanyName(): string | undefined {
    return this.customerCompany?.name;
  }

  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson', 'isPartner'])
  @SaplingDependsOn({
    parentField: 'customerCompany',
    targetField: 'company',
    requireParent: true,
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 200,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  customerPerson?: Rel<PersonItem>;

  /**
   * First name of the person selected in customerPerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 201,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 201,
    tableVisible: false,
    mobileOrder: 201,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get customerPersonFirstName(): string | null | undefined {
    return this.customerPerson?.firstName;
  }

  /**
   * Last name of the person selected in customerPerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 202,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 202,
    tableVisible: false,
    mobileOrder: 202,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get customerPersonLastName(): string | undefined {
    return this.customerPerson?.lastName;
  }

  @ApiPropertyOptional({ type: () => CompanyItem })
  @Sapling(['isCompany', 'isCurrentCompany'])
  @SaplingForm({
    order: 300,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => CompanyItem, { nullable: true })
  responsibleCompany?: Rel<CompanyItem>;

  /**
   * Name of the company selected in responsibleCompany.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 301,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 2,
    visible: false,
    tableOrder: 301,
    tableVisible: false,
    mobileOrder: 301,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get responsibleCompanyName(): string | undefined {
    return this.responsibleCompany?.name;
  }

  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isPerson', 'isPartner', 'isCurrentPerson'])
  @SaplingDependsOn({
    parentField: 'responsibleCompany',
    targetField: 'company',
    requireParent: true,
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 400,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: true })
  responsiblePerson?: Rel<PersonItem>;

  /**
   * First name of the person selected in responsiblePerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 401,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 401,
    tableVisible: false,
    mobileOrder: 401,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get responsiblePersonFirstName(): string | null | undefined {
    return this.responsiblePerson?.firstName;
  }

  /**
   * Last name of the person selected in responsiblePerson.
   */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 402,
    group: 'internalCase.groupReference',
    groupOrder: 300,
    width: 1,
    visible: false,
    tableOrder: 402,
    tableVisible: false,
    mobileOrder: 402,
    mobileVisible: false,
  })
  @Property({ persist: false, nullable: true, length: 128 })
  get responsiblePersonLastName(): string | undefined {
    return this.responsiblePerson?.lastName;
  }

  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
