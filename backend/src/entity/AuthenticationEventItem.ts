import { type Rel } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  Property,
} from '@mikro-orm/decorators/legacy';
import { PersonItem } from './PersonItem';

@Entity()
@Index({ properties: ['person', 'occurredAt'] })
export class AuthenticationEventItem {
  @Property({ primary: true, autoincrement: true })
  handle?: number;

  @ManyToOne(() => PersonItem, { nullable: true })
  person?: Rel<PersonItem> | null;

  @Property({ length: 32 })
  eventType!: 'loginSuccess' | 'loginFailure' | 'logout';

  @Property({ length: 24 })
  provider!: 'local' | 'passkey' | 'azure' | 'google' | 'unknown';

  @Property({ type: 'datetime', index: true })
  occurredAt: Date = new Date();
}
