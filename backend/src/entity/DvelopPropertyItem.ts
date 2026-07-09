import { Collection, type Rel } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DvelopConnectionItem } from './DvelopConnectionItem';
import { DvelopEntityMappingPropertyItem } from './DvelopEntityMappingPropertyItem';
import { DvelopObjectDefinitionItem } from './DvelopObjectDefinitionItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Unique({ properties: ['connection', 'objectDefinition', 'dvelopId'] })
export class DvelopPropertyItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => DvelopConnectionItem })
  @SaplingForm({
    order: 100,
    group: 'dvelopProperty.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => DvelopConnectionItem, { nullable: false })
  connection!: Rel<DvelopConnectionItem>;

  @ApiPropertyOptional({ type: () => DvelopObjectDefinitionItem })
  @SaplingForm({
    order: 150,
    group: 'dvelopProperty.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 150,
    tableVisible: true,
    mobileOrder: 150,
    mobileVisible: false,
  })
  @ManyToOne(() => DvelopObjectDefinitionItem, {
    nullable: true,
    deleteRule: 'set null',
  })
  objectDefinition?: Rel<DvelopObjectDefinitionItem> | null;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 200,
    group: 'dvelopProperty.groupBasics',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ length: 256 })
  title!: string;

  @ApiProperty()
  @Sapling(['isValue'])
  @SaplingForm({
    order: 300,
    group: 'dvelopProperty.groupBasics',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 128 })
  dvelopId!: string;

  @ApiPropertyOptional()
  @Sapling(['isChip'])
  @SaplingForm({
    order: 400,
    group: 'dvelopProperty.groupBasics',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ length: 64, nullable: true })
  dataType?: string | null;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 500,
    group: 'dvelopProperty.groupBasics',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 500,
    tableVisible: false,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ default: false })
  @SaplingForm({
    order: 600,
    group: 'dvelopProperty.groupBehavior',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ default: false })
  isRequired = false;

  @ApiPropertyOptional({ default: false })
  @SaplingForm({
    order: 700,
    group: 'dvelopProperty.groupBehavior',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ default: false })
  isMultiValue = false;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 800,
    group: 'dvelopProperty.groupStatus',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 800,
    tableVisible: true,
    mobileOrder: 800,
    mobileVisible: true,
  })
  @Property({ default: true })
  isActive = true;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 900,
    group: 'dvelopProperty.groupStatus',
    groupOrder: 400,
    width: 2,
    visible: true,
    tableOrder: 900,
    tableVisible: true,
    mobileOrder: 900,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  lastSyncedAt?: Date | null;

  @ApiPropertyOptional({
    type: () => DvelopEntityMappingPropertyItem,
    isArray: true,
  })
  @OneToMany(
    () => DvelopEntityMappingPropertyItem,
    (mappingProperty) => mappingProperty.property,
  )
  mappingProperties: Collection<Rel<DvelopEntityMappingPropertyItem>> =
    new Collection<Rel<DvelopEntityMappingPropertyItem>>(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
