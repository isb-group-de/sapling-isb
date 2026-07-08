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
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Unique({ properties: ['connection', 'dvelopId'] })
export class DvelopRepositoryItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => DvelopConnectionItem })
  @SaplingForm({
    order: 100,
    group: 'dvelopRepository.groupReference',
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
    group: 'dvelopRepository.groupBasics',
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
    group: 'dvelopRepository.groupBasics',
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
    group: 'dvelopRepository.groupBasics',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 400,
    tableVisible: true,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ length: 64, nullable: true })
  version?: string | null;

  @ApiPropertyOptional({ default: false })
  @SaplingForm({
    order: 500,
    group: 'dvelopRepository.groupStatus',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: true,
  })
  @Property({ default: false })
  isDefault = false;

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 600,
    group: 'dvelopRepository.groupStatus',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: true,
  })
  @Property({ default: true })
  isAvailable = true;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @SaplingForm({
    order: 700,
    group: 'dvelopRepository.groupStatus',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 700,
    tableVisible: true,
    mobileOrder: 700,
    mobileVisible: false,
  })
  @Property({ nullable: true, type: 'datetime' })
  lastSyncedAt?: Date | null;

  @ApiPropertyOptional({
    type: () => DvelopConnectionItem,
    isArray: true,
  })
  @OneToMany(() => DvelopConnectionItem, (connection) => connection.repository)
  selectedConnections: Collection<Rel<DvelopConnectionItem>> = new Collection<
    Rel<DvelopConnectionItem>
  >(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
