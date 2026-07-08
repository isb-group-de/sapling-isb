import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DvelopEntityMappingItem } from './DvelopEntityMappingItem';
import { DvelopObjectDefinitionItem } from './DvelopObjectDefinitionItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Unique({ properties: ['mapping', 'objectDefinition'] })
export class DvelopEntityMappingSearchCategoryItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => DvelopEntityMappingItem })
  @SaplingForm({
    order: 100,
    group: 'dvelopEntityMappingSearchCategory.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => DvelopEntityMappingItem, { nullable: false })
  mapping!: Rel<DvelopEntityMappingItem>;

  @ApiProperty({ type: () => DvelopObjectDefinitionItem })
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 200,
    group: 'dvelopEntityMappingSearchCategory.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @ManyToOne(() => DvelopObjectDefinitionItem, { nullable: false })
  objectDefinition!: Rel<DvelopObjectDefinitionItem>;

  @ApiPropertyOptional({ default: 0 })
  @SaplingForm({
    order: 300,
    group: 'dvelopEntityMappingSearchCategory.groupBehavior',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ default: 0 })
  sortOrder = 0;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 400,
    group: 'dvelopEntityMappingSearchCategory.groupBehavior',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
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
