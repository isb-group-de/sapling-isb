import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DvelopEntityMappingItem } from './DvelopEntityMappingItem';
import { DvelopPropertyItem } from './DvelopPropertyItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Unique({ properties: ['mapping', 'property'] })
export class DvelopEntityMappingPropertyItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => DvelopEntityMappingItem })
  @SaplingForm({
    order: 100,
    group: 'dvelopEntityMappingProperty.groupReference',
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

  @ApiProperty({ type: () => DvelopPropertyItem })
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 200,
    group: 'dvelopEntityMappingProperty.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @ManyToOne(() => DvelopPropertyItem, { nullable: false })
  property!: Rel<DvelopPropertyItem>;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 300,
    group: 'dvelopEntityMappingProperty.groupValue',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: true })
  sourceField?: string | null;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 400,
    group: 'dvelopEntityMappingProperty.groupValue',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ length: 256, nullable: true })
  staticValue?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @SaplingForm({
    order: 500,
    group: 'dvelopEntityMappingProperty.groupBehavior',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ default: 0 })
  sortOrder = 0;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 600,
    group: 'dvelopEntityMappingProperty.groupBehavior',
    groupOrder: 300,
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
