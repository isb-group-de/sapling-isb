import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Entity,
  ManyToOne,
  Property,
  Unique,
  Trigger,
} from '@mikro-orm/decorators/legacy';
import { type Rel } from '@mikro-orm/core';
import { PersonItem } from './PersonItem';
import { AiPromptTemplateItem } from './AiPromptTemplateItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Trigger({
  name: 'immutable_prompt_version',
  timing: 'before',
  events: ['update', 'delete'],
  expression:
    'create trigger immutable_prompt_version before update or delete on ai_prompt_version_item for each row execute function sapling_immutable_prompt_version();',
})
@Unique({ properties: ['template', 'version'] })
export class AiPromptVersionItem {
  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 50,
    group: 'aiPromptVersion.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 50,
    tableVisible: false,
    mobileOrder: 50,
    mobileVisible: false,
  })
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty({ type: () => AiPromptTemplateItem })
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 100,
    group: 'aiPromptVersion.groupBasics',
    groupOrder: 100,
    width: 3,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => AiPromptTemplateItem, { deleteRule: 'restrict' })
  template!: Rel<AiPromptTemplateItem>;

  @ApiProperty()
  @SaplingForm({
    order: 200,
    group: 'aiPromptVersion.groupBasics',
    groupOrder: 100,
    width: 1,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Sapling(['isValue', 'isReadOnly', 'isOrderDESC'])
  @Property()
  version!: number;

  @ApiProperty()
  @SaplingForm({
    order: 100,
    group: 'aiPromptVersion.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Sapling(['isMarkdown', 'isReadOnly'])
  @Property({ type: 'text' })
  content!: string;

  @ApiProperty()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 200,
    group: 'aiPromptVersion.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ type: 'json' })
  variables: string[] = [];

  @ApiPropertyOptional()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 300,
    group: 'aiPromptVersion.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @Property({ type: 'text', nullable: true })
  changeNote?: string | null;

  @ApiPropertyOptional({ type: () => PersonItem })
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 100,
    group: 'aiPromptVersion.groupPublication',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ManyToOne(() => PersonItem, { nullable: true, deleteRule: 'set null' })
  author?: Rel<PersonItem> | null;

  @ApiProperty()
  @Sapling(['isReadOnly'])
  @SaplingForm({
    order: 300,
    group: 'aiPromptVersion.groupPublication',
    groupOrder: 300,
    width: 4,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ length: 64 })
  checksum!: string;

  @ApiProperty()
  @SaplingForm({
    order: 200,
    group: 'aiPromptVersion.groupPublication',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime' })
  publishedAt: Date = new Date();
}
