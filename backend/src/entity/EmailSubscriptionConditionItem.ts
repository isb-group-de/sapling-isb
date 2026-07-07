import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type Rel } from '@mikro-orm/core';
import { EmailSubscriptionItem } from './EmailSubscriptionItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
export class EmailSubscriptionConditionItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => EmailSubscriptionItem })
  @Sapling(['isHideAsReference'])
  @ManyToOne(() => EmailSubscriptionItem, {
    nullable: false,
    deleteRule: 'cascade',
  })
  subscription!: Rel<EmailSubscriptionItem>;

  @ApiProperty()
  @Sapling(['isValue'])
  @SaplingForm({
    order: 100,
    group: 'emailSubscriptionCondition.groupCondition',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 128, nullable: false })
  observedField!: string;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 200,
    group: 'emailSubscriptionCondition.groupCondition',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 256, nullable: true })
  oldValue?: string | null;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 300,
    group: 'emailSubscriptionCondition.groupCondition',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ length: 256, nullable: true })
  newValue?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @Sapling(['isSystem'])
  @Property({ default: 0, nullable: false })
  sortOrder: number = 0;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
