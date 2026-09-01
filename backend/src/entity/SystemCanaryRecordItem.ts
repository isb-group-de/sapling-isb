import { Entity, Property } from '@mikro-orm/decorators/legacy';
import { Sapling } from './global/entity.decorator';

@Entity()
export class SystemCanaryRecordItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @Sapling(['isSystem', 'isValue'])
  @Property({ length: 96, unique: true })
  marker!: string;

  @Sapling(['isSystem'])
  @Property({ type: 'datetime' })
  createdAt: Date = new Date();
}
