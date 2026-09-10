import { type Rel } from '@mikro-orm/core';
import {
  Index,
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Sapling,
  SaplingForm,
  SaplingGenericReference,
} from './global/entity.decorator';
import { EntityItem } from './EntityItem';
import { ImportBatchItem } from './ImportBatchItem';
import { ImportSourceItem } from './ImportSourceItem';

@Index({
  name: 'external_record_link_entity_external_key_hash_index',
  properties: ['entity', 'externalKeyHash'],
})
@Index({
  name: 'external_record_link_item_entity_reference_index',
  properties: ['entity', 'reference'],
})
@Index({
  name: 'external_record_link_item_first_import_batch_handle_index',
  properties: ['firstImportBatch'],
})
@Index({
  name: 'external_record_link_item_last_import_batch_handle_index',
  properties: ['lastImportBatch'],
})
@Entity()
@Unique({ properties: ['source', 'entity', 'externalKeyHash'] })
export class ExternalRecordLinkItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => ImportSourceItem })
  @SaplingForm({
    order: 100,
    group: 'externalRecordLink.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => ImportSourceItem, { nullable: false })
  source!: Rel<ImportSourceItem>;

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity'])
  @SaplingForm({
    order: 200,
    group: 'externalRecordLink.groupReference',
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

  @ApiProperty()
  @Sapling(['isSystem', 'isValue'])
  @SaplingGenericReference({ entityField: 'entity', handleField: 'reference' })
  @SaplingForm({
    order: 300,
    group: 'externalRecordLink.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ length: 64 })
  reference!: string;

  @ApiProperty()
  @Sapling(['isValue', 'isSearchExcluded'])
  @SaplingForm({
    order: 100,
    group: 'externalRecordLink.groupExternalKey',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ length: 128 })
  externalKeyHash!: string;

  @ApiProperty()
  @SaplingForm({
    order: 200,
    group: 'externalRecordLink.groupExternalKey',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ type: 'json', nullable: false })
  externalKeyParts!: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => ImportBatchItem })
  @SaplingForm({
    order: 100,
    group: 'externalRecordLink.groupImport',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => ImportBatchItem, { nullable: true })
  firstImportBatch?: Rel<ImportBatchItem> | null;

  @ApiPropertyOptional({ type: () => ImportBatchItem })
  @SaplingForm({
    order: 200,
    group: 'externalRecordLink.groupImport',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => ImportBatchItem, { nullable: true })
  lastImportBatch?: Rel<ImportBatchItem> | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @SaplingForm({
    order: 300,
    group: 'externalRecordLink.groupImport',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  lastSeenAt?: Date;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
