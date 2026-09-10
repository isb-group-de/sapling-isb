import { type Rel } from '@mikro-orm/core';
import {
  Index,
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityItem } from './EntityItem';
import { CustomFieldDefinitionItem } from './CustomFieldDefinitionItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Index({
  name: 'custom_field_value_definition_record_reference_index',
  properties: ['definition', 'recordReference'],
})
@Index({
  name: 'custom_field_value_item_boolean_filter_index',
  properties: ['entity', 'definition', 'valueBoolean'],
})
@Index({
  name: 'custom_field_value_item_date_filter_index',
  properties: ['entity', 'definition', 'valueDate'],
})
@Index({
  name: 'custom_field_value_item_datetime_filter_index',
  properties: ['entity', 'definition', 'valueDateTime'],
})
@Index({
  name: 'custom_field_value_item_number_filter_index',
  properties: ['entity', 'definition', 'valueNumber'],
})
@Index({
  name: 'custom_field_value_item_string_filter_index',
  properties: ['entity', 'definition', 'valueString'],
})
@Entity()
@Unique({ properties: ['entity', 'recordReference', 'definition'] })
export class CustomFieldValueItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity'])
  @SaplingForm({
    order: 100,
    group: 'customFieldValue.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => EntityItem, { nullable: false })
  entity!: Rel<EntityItem>;

  @ApiProperty({ type: () => CustomFieldDefinitionItem })
  @SaplingForm({
    order: 200,
    group: 'customFieldValue.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @ManyToOne(() => CustomFieldDefinitionItem, { nullable: false })
  definition!: Rel<CustomFieldDefinitionItem>;

  @ApiProperty()
  @Sapling(['isValue'])
  @SaplingForm({
    order: 300,
    group: 'customFieldValue.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 64 })
  recordReference!: string;

  @ApiPropertyOptional()
  @Property({ type: 'text', nullable: true })
  valueString?: string | null;

  @ApiPropertyOptional()
  @Property({ type: 'float', nullable: true })
  valueNumber?: number | null;

  @ApiPropertyOptional({ default: false })
  @Property({ nullable: true, default: false })
  valueBoolean?: boolean | null = false;

  @ApiPropertyOptional({ type: 'string', format: 'date' })
  @Property({ nullable: true, type: 'date' })
  valueDate?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Property({ nullable: true, type: 'datetime' })
  valueDateTime?: Date | null;

  @ApiPropertyOptional()
  @Property({ type: 'json', nullable: true })
  valueJson?: unknown;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
