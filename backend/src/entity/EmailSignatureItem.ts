import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonItem } from './PersonItem';
import { Sapling, SaplingForm } from './global/entity.decorator';

@Entity()
@Index({
  name: 'email_signature_rotation_idx',
  properties: ['person', 'isActive', 'useInRotation', 'lastUsedAt', 'handle'],
})
export class EmailSignatureItem {
  @ApiProperty()
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({ order: 100, width: 4, visible: true, tableVisible: true })
  @Property({ length: 128 })
  name!: string;

  @ApiProperty()
  @Sapling(['isMarkdown'])
  @SaplingForm({ order: 200, width: 4, visible: true, tableVisible: false })
  @Property({ length: 8192 })
  bodyMarkdown!: string;

  @ApiProperty({ default: true })
  @SaplingForm({ order: 300, width: 2, visible: true, tableVisible: true })
  @Property({ default: true })
  isActive: boolean = true;

  @ApiProperty({ default: true })
  @SaplingForm({ order: 400, width: 2, visible: true, tableVisible: true })
  @Property({ default: true })
  useInRotation: boolean = true;

  @ApiProperty({ type: () => PersonItem })
  @Sapling(['isPerson', 'isSystem'])
  @ManyToOne(() => PersonItem, { deleteRule: 'cascade' })
  person!: Rel<PersonItem>;

  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', nullable: true })
  lastUsedAt?: Date | null;

  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt = new Date();

  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt = new Date();
}
