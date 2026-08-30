import { Entity, Property } from '@mikro-orm/decorators/legacy';

@Entity()
export class SystemTelemetryInstanceItem {
  @Property({ primary: true, length: 128 })
  handle!: string;

  @Property({ length: 255 })
  hostname!: string;

  @Property({ length: 64, nullable: true })
  appVersion?: string | null;

  @Property({ type: 'datetime' })
  processStartedAt!: Date;

  @Property({ type: 'datetime', nullable: true, index: true })
  lastSampleAt?: Date | null;

  @Property({ default: true })
  collectorEnabled = true;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
