import { Collection, type Rel } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Sapling,
  SaplingDependsOn,
  SaplingForm,
} from './global/entity.decorator';
import { EntityItem } from './EntityItem';
import { DvelopConnectionItem } from './DvelopConnectionItem';
import { DvelopObjectDefinitionItem } from './DvelopObjectDefinitionItem';
import { DvelopEntityMappingSearchCategoryItem } from './DvelopEntityMappingSearchCategoryItem';
import { DvelopEntityMappingPropertyItem } from './DvelopEntityMappingPropertyItem';

@Entity()
export class DvelopEntityMappingItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => DvelopConnectionItem })
  @SaplingForm({
    order: 100,
    group: 'dvelopEntityMapping.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => DvelopConnectionItem, { nullable: false })
  connection!: Rel<DvelopConnectionItem>;

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity'])
  @SaplingForm({
    order: 200,
    group: 'dvelopEntityMapping.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @ManyToOne(() => EntityItem, { nullable: false })
  entity!: Rel<EntityItem>;

  @ApiPropertyOptional({ type: () => DvelopObjectDefinitionItem })
  @SaplingDependsOn({
    parentField: 'connection',
    targetField: 'connection',
    clearOnParentChange: true,
  })
  @SaplingForm({
    order: 300,
    group: 'dvelopEntityMapping.groupDvelop',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @ManyToOne(() => DvelopObjectDefinitionItem, { nullable: true })
  objectDefinition?: Rel<DvelopObjectDefinitionItem>;

  @ApiPropertyOptional({
    type: () => DvelopEntityMappingSearchCategoryItem,
    isArray: true,
  })
  @OneToMany(
    () => DvelopEntityMappingSearchCategoryItem,
    (searchCategory) => searchCategory.mapping,
  )
  searchCategories: Collection<Rel<DvelopEntityMappingSearchCategoryItem>> =
    new Collection<Rel<DvelopEntityMappingSearchCategoryItem>>(this);

  @ApiPropertyOptional({
    type: () => DvelopEntityMappingPropertyItem,
    isArray: true,
  })
  @OneToMany(
    () => DvelopEntityMappingPropertyItem,
    (propertyMapping) => propertyMapping.mapping,
  )
  propertyMappings: Collection<Rel<DvelopEntityMappingPropertyItem>> =
    new Collection<Rel<DvelopEntityMappingPropertyItem>>(this);

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 600,
    group: 'dvelopEntityMapping.groupStatus',
    groupOrder: 400,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: true,
  })
  @Property({ default: true })
  isActive = true;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
