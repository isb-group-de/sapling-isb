import { Migration } from '@mikro-orm/migrations';

export class Migration20260903110000 extends Migration {
  override up(): void {
    this.addSql(`alter table "event_item"
      add column "create_online_meeting" boolean not null default false;`);
    this.addSql(`update "event_item"
      set "create_online_meeting" = true
      where nullif(trim("online_meeting_url"), '') is not null;`);
    this.addSql(
      `alter table "event_google_item" add column "ical_uid" varchar(1024) null;`,
    );
    this.addSql(
      `alter table "event_google_item" add constraint "event_google_item_ical_uid_unique" unique ("ical_uid");`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "event_google_item" drop constraint if exists "event_google_item_ical_uid_unique";`,
    );
    this.addSql(
      `alter table "event_google_item" drop column if exists "ical_uid";`,
    );
    this.addSql(`alter table "event_item"
      drop column "create_online_meeting";`);
  }
}
