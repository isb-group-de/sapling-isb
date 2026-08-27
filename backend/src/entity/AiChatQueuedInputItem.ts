import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiChatMessageItem } from './AiChatMessageItem';
import { AiChatSessionItem } from './AiChatSessionItem';
import { PersonItem } from './PersonItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({ properties: ['session', 'status', 'mode', 'createdAt'] })
export class AiChatQueuedInputItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => AiChatSessionItem })
  @SaplingForm({
    order: 100,
    group: 'aiChatQueuedInput.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @ManyToOne(() => AiChatSessionItem, { nullable: false })
  session!: Rel<AiChatSessionItem>;

  @ApiProperty({ type: () => PersonItem })
  @Sapling(['isPerson', 'isCurrentPerson'])
  @SaplingForm({
    order: 200,
    group: 'aiChatQueuedInput.groupReference',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ManyToOne(() => PersonItem, { nullable: false })
  person!: Rel<PersonItem>;

  @ApiProperty({ enum: ['queue', 'steer'] })
  @Sapling(['isChip'])
  @Property({ length: 16, nullable: false, default: 'queue' })
  mode: 'queue' | 'steer' = 'queue';

  @ApiProperty({
    enum: ['queued', 'running', 'completed', 'cancelled', 'failed'],
  })
  @Sapling(['isChip'])
  @Property({ length: 16, nullable: false, default: 'queued' })
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed' =
    'queued';

  @ApiProperty()
  @Property({ length: 16384, nullable: false })
  content!: string;

  @ApiPropertyOptional()
  @Property({ type: 'json', nullable: true })
  requestPayload?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: () => AiChatMessageItem })
  @ManyToOne(() => AiChatMessageItem, { nullable: true })
  userMessage?: Rel<AiChatMessageItem> | null;

  @ApiPropertyOptional({ type: () => AiChatMessageItem })
  @ManyToOne(() => AiChatMessageItem, { nullable: true })
  assistantMessage?: Rel<AiChatMessageItem> | null;

  @ApiPropertyOptional()
  @Property({ type: 'json', nullable: true })
  errorPayload?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Property({ nullable: true, type: 'datetime' })
  startedAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Property({ nullable: true, type: 'datetime' })
  completedAt?: Date | null;
}
