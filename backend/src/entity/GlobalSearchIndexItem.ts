import { Entity, Property, Unique } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sapling, SaplingForm } from './global/entity.decorator';

export const GLOBAL_SEARCH_INDEX_ENTITY_HANDLE = 'globalSearchIndex';

@Entity()
@Unique({
  properties: ['entityHandle', 'recordHandle', 'fieldPath'],
})
export class GlobalSearchIndexItem {
  // #region Properties: Persisted
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 100,
    group: 'globalSearchIndex.groupIdentity',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isReadOnly', 'isValue', 'isOrderASC'])
  @SaplingForm({
    order: 200,
    group: 'globalSearchIndex.groupIdentity',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 64, nullable: false })
  entityHandle!: string;

  @ApiProperty()
  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 300,
    group: 'globalSearchIndex.groupIdentity',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  recordHandle!: string;

  @ApiProperty()
  @Sapling(['isReadOnly', 'isValue'])
  @SaplingForm({
    order: 400,
    group: 'globalSearchIndex.groupIdentity',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  fieldPath!: string;

  @ApiProperty()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 100,
    group: 'globalSearchIndex.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ columnType: 'text', nullable: false })
  fieldValue!: string;

  @ApiProperty()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 200,
    group: 'globalSearchIndex.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 600,
    tableVisible: false,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @Property({ columnType: 'text', nullable: false })
  normalizedValue!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 100,
    group: 'globalSearchIndex.groupTimestamps',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: false,
  })
  @Property({ nullable: false, type: 'datetime' })
  sourceUpdatedAt!: Date;
  // #endregion

  // #region Properties: System
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
  // #endregion
}
