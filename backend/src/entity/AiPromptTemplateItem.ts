import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { type Rel } from '@mikro-orm/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sapling, SaplingForm } from './global/entity.decorator';
import { AiPromptVersionItem } from './AiPromptVersionItem';

@Entity()
export class AiPromptTemplateItem {
  @SaplingForm({
    order: 50,
    group: 'aiPromptTemplate.groupBasics',
    groupOrder: 100,
    width: 4,
    visible: true,
    tableOrder: 50,
    tableVisible: true,
    mobileOrder: 50,
    mobileVisible: false,
  })
  @ApiProperty()
  @Sapling(['isReadOnly'])
  @Property({ primary: true, length: 190 })
  handle!: string;

  @SaplingForm({
    order: 100,
    group: 'aiPromptTemplate.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @Property({ length: 256 })
  title!: string;

  @ApiPropertyOptional()
  @SaplingForm({
    order: 100,
    group: 'aiPromptTemplate.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 100,
    tableVisible: false,
    mobileOrder: 100,
    mobileVisible: false,
  })
  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @ApiProperty()
  @SaplingForm({
    order: 200,
    group: 'aiPromptTemplate.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Sapling(['isReadOnly'])
  @Property({ length: 128 })
  purpose!: string;

  @SaplingForm({
    order: 200,
    group: 'aiPromptTemplate.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @ApiProperty()
  @Sapling(['isMarkdown'])
  @Property({ type: 'text' })
  draft!: string;

  @ApiProperty()
  @SaplingForm({
    order: 300,
    group: 'aiPromptTemplate.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 300,
    tableVisible: false,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Sapling(['isReadOnly'])
  @Property({ type: 'json' })
  variables: string[] = [];

  @ApiPropertyOptional({ type: () => AiPromptVersionItem })
  @SaplingForm({
    order: 100,
    group: 'aiPromptTemplate.groupPublication',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Sapling(['isReadOnly'])
  @ManyToOne(() => AiPromptVersionItem, {
    nullable: true,
    deleteRule: 'restrict',
  })
  publishedVersion?: Rel<AiPromptVersionItem> | null;

  @ApiProperty()
  @SaplingForm({
    order: 200,
    group: 'aiPromptTemplate.groupPublication',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: true,
  })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
