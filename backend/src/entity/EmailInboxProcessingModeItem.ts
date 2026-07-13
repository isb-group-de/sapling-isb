import { Collection } from '@mikro-orm/core';
import { Entity, OneToMany, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailInboxSubscriptionItem } from './EmailInboxSubscriptionItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
export class EmailInboxProcessingModeItem {
  @ApiProperty()
  @Property({ primary: true, length: 64 })
  handle!: string;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'emailInboxProcessingMode.groupContent',
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
  @Property({ length: 64, nullable: false, default: 'mdi-email-outline' })
  icon = 'mdi-email-outline';

  @ApiPropertyOptional({ default: '#1976D2' })
  @Sapling(['isColor'])
  @Property({ length: 32, nullable: false, default: '#1976D2' })
  color = '#1976D2';

  @ApiPropertyOptional({
    type: () => EmailInboxSubscriptionItem,
    isArray: true,
  })
  @OneToMany(
    () => EmailInboxSubscriptionItem,
    (subscription) => subscription.processingMode,
  )
  subscriptions: Collection<EmailInboxSubscriptionItem> =
    new Collection<EmailInboxSubscriptionItem>(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
