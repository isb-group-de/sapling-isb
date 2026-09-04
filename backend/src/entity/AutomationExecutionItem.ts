import {
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type Rel } from '@mikro-orm/core';
import { AutomationEventItem } from './AutomationEventItem';
import { EntityItem } from './EntityItem';
import { Sapling, SaplingGenericReference } from './global/entity.decorator';

@Entity()
@Unique({ properties: ['deduplicationKey'] })
export class AutomationExecutionItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isReadOnly'])
  @Property({ length: 190 })
  deduplicationKey!: string;

  @ManyToOne(() => AutomationEventItem, { deleteRule: 'cascade' })
  event!: Rel<AutomationEventItem>;

  @ManyToOne(() => EntityItem)
  targetEntity!: Rel<EntityItem>;

  @SaplingGenericReference({
    entityField: 'targetEntity',
    handleField: 'targetHandle',
  })
  @Property({ length: 64 })
  targetHandle!: string;

  @Property({ length: 16 })
  actionType!: 'inbox' | 'teams' | 'webhook' | 'field';

  @Property({ length: 32 })
  ruleHandle!: string;

  @Property({ length: 16 })
  status!: 'completed' | 'skipped' | 'failed';

  @ApiPropertyOptional()
  @Property({ type: 'text', nullable: true })
  message?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
