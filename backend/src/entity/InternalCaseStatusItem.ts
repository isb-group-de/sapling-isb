import { Collection } from '@mikro-orm/core';
import { Entity, OneToMany, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sapling, SaplingForm } from './global/entity.decorator';
import { InternalCaseItem } from './InternalCaseItem';

@Entity()
export class InternalCaseStatusItem {
  @ApiProperty()
  @Property({ primary: true, length: 64 })
  handle!: string;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'internalCaseStatus.groupContent',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 64, nullable: false })
  description!: string;

  @ApiProperty()
  @Sapling(['isColor'])
  @SaplingForm({
    order: 100,
    group: 'internalCaseStatus.groupAppearance',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ length: 16, nullable: false })
  color!: string;

  @ApiPropertyOptional({ default: 'mdi-clipboard-text-outline' })
  @Sapling(['isIcon'])
  @SaplingForm({
    order: 200,
    group: 'internalCaseStatus.groupAppearance',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({
    default: 'mdi-clipboard-text-outline',
    length: 64,
    nullable: false,
  })
  icon?: string = 'mdi-clipboard-text-outline';

  @ApiPropertyOptional({ default: true })
  @SaplingForm({
    order: 100,
    group: 'internalCaseStatus.groupConfiguration',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ default: true, nullable: false })
  isOpen?: boolean = true;

  @ApiPropertyOptional({ type: () => InternalCaseItem, isArray: true })
  @OneToMany(() => InternalCaseItem, (internalCase) => internalCase.status)
  internalCases: Collection<InternalCaseItem> =
    new Collection<InternalCaseItem>(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
