import { Migration } from '@mikro-orm/migrations';

export class Migration20260828150000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "ticket_time_tracking_item" alter column "description" type varchar(2048) using ("description"::varchar(2048));`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "ticket_time_tracking_item" alter column "description" type varchar(256) using ("description"::varchar(256));`,
    );
  }
}
