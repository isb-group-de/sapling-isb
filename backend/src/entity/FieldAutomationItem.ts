import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type Rel } from '@mikro-orm/core';
import { EntityItem } from './EntityItem';
import { Sapling, SaplingForm } from './global/entity.decorator';
import { WebhookSubscriptionTypeItem } from './WebhookSubscriptionTypeItem';

export type AutomationPathStep = {
  field: string;
  direction?: 'forward' | 'inverse';
  entity?: string;
};
export type AutomationCondition = {
  scope: 'source' | 'target';
  field: string;
  operator?: 'changed' | 'equals' | 'changesTo' | 'changesFrom' | 'transition';
  oldValue?: unknown;
  newValue?: unknown;
  groupOrder?: number;
};
export type AutomationAssignment = { field: string; value: unknown };

@Entity()
export class FieldAutomationItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    group: 'fieldAutomation.groupBasics',
    groupOrder: 100,
    order: 100,
    width: 4,
    visible: true,
    tableVisible: true,
  })
  @Property({ length: 128 })
  description!: string;

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity'])
  @SaplingForm({
    group: 'fieldAutomation.groupBasics',
    groupOrder: 100,
    order: 200,
    width: 1,
    visible: true,
  })
  @ManyToOne(() => EntityItem)
  sourceEntity!: Rel<EntityItem>;

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity'])
  @SaplingForm({
    group: 'fieldAutomation.groupBasics',
    groupOrder: 100,
    order: 300,
    width: 1,
    visible: true,
  })
  @ManyToOne(() => EntityItem)
  targetEntity!: Rel<EntityItem>;

  @ApiProperty({ type: () => WebhookSubscriptionTypeItem })
  @Sapling(['isChip'])
  @SaplingForm({
    group: 'fieldAutomation.groupBasics',
    groupOrder: 100,
    order: 400,
    width: 1,
    visible: true,
  })
  @ManyToOne(() => WebhookSubscriptionTypeItem, { defaultRaw: `'afterUpdate'` })
  operation!: Rel<WebhookSubscriptionTypeItem>;

  @ApiPropertyOptional()
  @SaplingForm({
    group: 'fieldAutomation.groupConfiguration',
    groupOrder: 200,
    order: 100,
    width: 4,
    visible: true,
  })
  @Property({ type: 'json', default: '[]' })
  referencePath: AutomationPathStep[] = [];

  @ApiPropertyOptional()
  @SaplingForm({
    group: 'fieldAutomation.groupConfiguration',
    groupOrder: 200,
    order: 200,
    width: 4,
    visible: true,
  })
  @Property({ type: 'json', default: '[]' })
  conditions: AutomationCondition[] = [];

  @ApiPropertyOptional()
  @SaplingForm({
    group: 'fieldAutomation.groupConfiguration',
    groupOrder: 200,
    order: 300,
    width: 4,
    visible: true,
  })
  @Property({ type: 'json', default: '[]' })
  assignments: AutomationAssignment[] = [];

  @ApiPropertyOptional()
  @SaplingForm({
    group: 'fieldAutomation.groupBasics',
    groupOrder: 100,
    order: 500,
    width: 1,
    visible: true,
  })
  @Property({ default: 0 })
  priority = 0;

  @ApiPropertyOptional()
  @SaplingForm({
    group: 'fieldAutomation.groupBasics',
    groupOrder: 100,
    order: 600,
    width: 1,
    visible: true,
  })
  @Property({ default: false })
  isActive = false;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
