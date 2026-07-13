import { Collection } from '@mikro-orm/core';
import { Entity, OneToMany, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InboundEmailItem } from './InboundEmailItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
export class InboundEmailStatusItem {
  @ApiProperty()
  @Property({ primary: true, length: 64 })
  handle!: string;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'inboundEmailStatus.groupContent',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  description!: string;

  @ApiPropertyOptional({ default: 'mdi-email-outline' })
  @Sapling(['isIcon'])
  @SaplingForm({
    order: 100,
    group: 'inboundEmailStatus.groupAppearance',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ length: 64, nullable: false, default: 'mdi-email-outline' })
  icon = 'mdi-email-outline';

  @ApiPropertyOptional({ default: '#607D8B' })
  @Sapling(['isColor'])
  @SaplingForm({
    order: 200,
    group: 'inboundEmailStatus.groupAppearance',
    groupOrder: 200,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 32, nullable: false, default: '#607D8B' })
  color = '#607D8B';

  @ApiPropertyOptional({ type: () => InboundEmailItem, isArray: true })
  @OneToMany(() => InboundEmailItem, (email) => email.status)
  emails: Collection<InboundEmailItem> = new Collection<InboundEmailItem>(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
