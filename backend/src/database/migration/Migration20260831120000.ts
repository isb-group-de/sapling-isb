import { Migration } from '@mikro-orm/migrations';

/**
 * Use Outlook's calendar-wide identity to prevent one shared meeting from
 * being imported once per organizer/attendee mailbox.
 */
export class Migration20260831120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "event_azure_item" add column "ical_uid" varchar(1024) null;`,
    );
    this.addSql(
      `alter table "event_azure_item" add constraint "event_azure_item_ical_uid_unique" unique ("ical_uid");`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "event_azure_item" drop constraint if exists "event_azure_item_ical_uid_unique";`,
    );
    this.addSql(
      `alter table "event_azure_item" drop column if exists "ical_uid";`,
    );
  }
}
