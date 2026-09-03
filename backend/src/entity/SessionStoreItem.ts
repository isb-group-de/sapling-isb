import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sapling, SaplingForm } from './global/entity.decorator';
import { PersonItem } from './PersonItem';

/**
 * @class SessionStoreItem
 * @summary Persisted express-session entry for durable server-side sessions.
 */
@Entity()
export class SessionStoreItem {
  // #region Properties: Persisted
  /**
   * Server-side session identifier.
   */
  @ApiProperty()
  @Sapling(['isValue', 'isOrderASC'])
  @SaplingForm({
    order: 100,
    group: 'sessionStore.groupBasics',
    groupOrder: 100,
    width: 2,
    visible: true,
    tableOrder: 100,
    tableVisible: true,
    mobileOrder: 100,
    mobileVisible: true,
  })
  @Property({ primary: true, length: 255, fieldName: 'handle' })
  handle!: string;

  /**
   * Serialized session payload.
   */
  @ApiProperty()
  @SaplingForm({
    order: 200,
    group: 'sessionStore.groupContent',
    groupOrder: 200,
    width: 4,
    visible: true,
    tableOrder: 200,
    tableVisible: false,
    mobileOrder: 200,
    mobileVisible: false,
  })
  @Property({ type: 'json', nullable: false })
  payload!: string;

  /**
   * Absolute session expiration timestamp.
   */
  @ApiProperty({ type: 'string', format: 'date-time' })
  @SaplingForm({
    order: 300,
    group: 'sessionStore.groupSchedule',
    groupOrder: 300,
    width: 2,
    visible: true,
    tableOrder: 300,
    tableVisible: true,
    mobileOrder: 300,
    mobileVisible: false,
  })
  @Property({ nullable: false, type: 'datetime', index: true })
  expiresAt!: Date;

  /** Numeric person handle denormalized from the Passport session payload. */
  @ApiPropertyOptional()
  @Sapling(['isReadOnly', 'isSystem'])
  @ManyToOne(() => PersonItem, {
    nullable: true,
    mapToPk: true,
    fieldName: 'person_handle',
    foreignKeyName: 'session_store_person_fk',
    deleteRule: 'cascade',
    index: 'session_store_person_idx',
  })
  personHandle?: number | null;

  /** Last authenticated activity observed for this interactive session. */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: true, type: 'datetime', index: true })
  lastSeenAt?: Date | null;
  // #endregion

  // #region Properties: System
  /**
   * Creation timestamp.
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  /**
   * Last update timestamp.
   */
  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @Sapling(['isReadOnly', 'isSystem'])
  @Property({ nullable: false, type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
  // #endregion
}
