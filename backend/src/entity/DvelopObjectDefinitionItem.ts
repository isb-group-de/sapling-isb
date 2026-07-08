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
import { DvelopEntityMappingItem } from './DvelopEntityMappingItem';
import { DvelopEntityMappingSearchCategoryItem } from './DvelopEntityMappingSearchCategoryItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Unique({ properties: ['connection', 'dvelopId'] })
export class DvelopObjectDefinitionItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => DvelopConnectionItem })
  @SaplingForm({
    order: 100,
    group: 'dvelopObjectDefinition.groupReference',
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

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 200,
    group: 'dvelopObjectDefinition.groupBasics',
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
    group: 'dvelopObjectDefinition.groupBasics',
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
  @SaplingForm({
    order: 400,
    group: 'dvelopObjectDefinition.groupBasics',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 400,
    tableVisible: false,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 500,
    group: 'dvelopObjectDefinition.groupStatus',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: true,
  })
  @Property({ default: true })
  isActive = true;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 600,
    group: 'dvelopObjectDefinition.groupStatus',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  lastSyncedAt?: Date | null;

  @ApiPropertyOptional({
    type: () => DvelopEntityMappingItem,
    isArray: true,
  })
  @OneToMany(
    () => DvelopEntityMappingItem,
    (mapping) => mapping.objectDefinition,
  )
  mappings: Collection<Rel<DvelopEntityMappingItem>> = new Collection<
    Rel<DvelopEntityMappingItem>
  >(this);

  @ApiPropertyOptional({
    type: () => DvelopEntityMappingSearchCategoryItem,
    isArray: true,
  })
  @OneToMany(
    () => DvelopEntityMappingSearchCategoryItem,
    (searchCategory) => searchCategory.objectDefinition,
  )
  searchCategoryMappings: Collection<
    Rel<DvelopEntityMappingSearchCategoryItem>
  > = new Collection<Rel<DvelopEntityMappingSearchCategoryItem>>(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
