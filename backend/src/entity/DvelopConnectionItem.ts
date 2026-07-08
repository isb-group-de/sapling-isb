import { Collection, type Rel } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  OneToMany,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Sapling,
  SaplingDependsOn,
  SaplingForm,
} from './global/entity.decorator';
import { DvelopEntityMappingItem } from './DvelopEntityMappingItem';
import { DvelopObjectDefinitionItem } from './DvelopObjectDefinitionItem';
import { DvelopPropertyItem } from './DvelopPropertyItem';
import { DvelopRepositoryItem } from './DvelopRepositoryItem';

@Entity()
export class DvelopConnectionItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'dvelopConnection.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ length: 128 })
  title!: string;

  @ApiProperty()
  @Sapling(['isLink'])
  @SaplingForm({
    order: 200,
    group: 'dvelopConnection.groupCloud',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: true,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ length: 512 })
  baseUrl!: string;

  @ApiPropertyOptional({
    type: () => DvelopRepositoryItem,
  })
  @SaplingDependsOn({
    parentField: 'handle',
    targetField: 'connection',
    requireParent: true,
  })
  @ApiPropertyOptional()
  @Sapling(['isSecurity'])
  @SaplingForm({
    order: 300,
    group: 'dvelopConnection.groupCloud',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 400,
    tableVisible: false,
    mobileOrder: 400,
    mobileVisible: false,
  })
  @Property({ length: 2048, nullable: true, hidden: true })
  apiKey?: string;

  @SaplingForm({
    order: 400,
    group: 'dvelopConnection.groupCloud',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: true,
  })
  @ManyToOne(() => DvelopRepositoryItem, { nullable: true })
  repository?: Rel<DvelopRepositoryItem>;

  @ApiPropertyOptional({
    type: () => DvelopObjectDefinitionItem,
  })
  @SaplingDependsOn({
    parentField: 'handle',
    targetField: 'connection',
    requireParent: true,
  })
  @SaplingForm({
    order: 500,
    group: 'dvelopConnection.groupCloud',
    groupOrder: 200,
    width: 2,
    visible: true,
    tableOrder: 500,
    tableVisible: true,
    mobileOrder: 500,
    mobileVisible: false,
  })
  @ManyToOne(() => DvelopObjectDefinitionItem, { nullable: true })
  defaultObjectDefinition?: Rel<DvelopObjectDefinitionItem>;

  @ApiPropertyOptional({
    type: () => DvelopRepositoryItem,
    isArray: true,
  })
  @OneToMany(() => DvelopRepositoryItem, (repository) => repository.connection)
  repositories: Collection<Rel<DvelopRepositoryItem>> = new Collection<
    Rel<DvelopRepositoryItem>
  >(this);

  @ApiPropertyOptional({
    type: () => DvelopObjectDefinitionItem,
    isArray: true,
  })
  @OneToMany(
    () => DvelopObjectDefinitionItem,
    (definition) => definition.connection,
  )
  objectDefinitions: Collection<Rel<DvelopObjectDefinitionItem>> =
    new Collection<Rel<DvelopObjectDefinitionItem>>(this);

  @ApiPropertyOptional({ type: () => DvelopPropertyItem, isArray: true })
  @OneToMany(() => DvelopPropertyItem, (property) => property.connection)
  properties: Collection<Rel<DvelopPropertyItem>> = new Collection<
    Rel<DvelopPropertyItem>
  >(this);

  @ApiPropertyOptional({ default: false })
  @SaplingForm({
    order: 600,
    group: 'dvelopConnection.groupStatus',
    groupOrder: 300,
    width: 1,
    visible: true,
    tableOrder: 600,
    tableVisible: true,
    mobileOrder: 600,
    mobileVisible: true,
  })
  @Property({ default: false })
  isActive = false;

  @ApiPropertyOptional({ type: () => DvelopEntityMappingItem, isArray: true })
  @OneToMany(() => DvelopEntityMappingItem, (mapping) => mapping.connection)
  mappings: Collection<Rel<DvelopEntityMappingItem>> = new Collection<
    Rel<DvelopEntityMappingItem>
  >(this);

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
