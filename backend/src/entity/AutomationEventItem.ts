import {
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type Rel } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { EntityItem } from './EntityItem';
import { PersonItem } from './PersonItem';
import { Sapling, SaplingGenericReference } from './global/entity.decorator';

export type AutomationOperation =
  | 'afterInsert'
  | 'afterUpdate'
  | 'afterDelete'
  | 'addReference'
  | 'deleteReference';
export type AutomationEventStatus =
  'pending' | 'processing' | 'completed' | 'failed';

@Entity()
@Unique({ properties: ['eventId'] })
export class AutomationEventItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isReadOnly'])
  @Property({ length: 36 })
  eventId: string = randomUUID();

  @ApiProperty({ type: () => EntityItem })
  @Sapling(['isEntity', 'isReadOnly'])
  @ManyToOne(() => EntityItem)
  sourceEntity!: Rel<EntityItem>;

  @ApiProperty()
  @SaplingGenericReference({
    entityField: 'sourceEntity',
    handleField: 'sourceHandle',
  })
  @Property({ length: 64 })
  sourceHandle!: string;

  @ApiProperty()
  @Property({ length: 32 })
  operation!: AutomationOperation;

  @ApiProperty({ type: () => PersonItem })
  @Sapling(['isPerson', 'isReadOnly'])
  @ManyToOne(() => PersonItem)
  actor!: Rel<PersonItem>;

  @ApiProperty()
  @Property({ length: 36 })
  chainId: string = randomUUID();

  @ApiPropertyOptional()
  @Property({ default: 0 })
  chainDepth = 0;

  @ApiPropertyOptional()
  @Property({ type: 'json', nullable: true })
  oldSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @Property({ type: 'json', nullable: true })
  newSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @Property({ type: 'json', nullable: true })
  context?: Record<string, unknown> | null;

  @ApiProperty()
  @Property({ length: 16, default: 'pending' })
  status: AutomationEventStatus = 'pending';

  @ApiPropertyOptional()
  @Property({ default: 0 })
  attemptCount = 0;

  @ApiPropertyOptional()
  @Property({ type: 'text', nullable: true })
  error?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', nullable: true })
  nextAttemptAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', nullable: true })
  processingStartedAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', nullable: true })
  completedAt?: Date | null;
}
