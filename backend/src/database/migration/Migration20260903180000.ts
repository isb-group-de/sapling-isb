import { Migration } from '@mikro-orm/migrations';

export class Migration20260903180000 extends Migration {
  override up(): void {
    this.replaceForeignKey(
      'inbox_notification_item',
      'inbox_notification_item_recipient_person_handle_foreign',
      'recipient_person_handle',
      'person_item',
    );
    this.replaceForeignKey(
      'inbox_notification_item',
      'inbox_notification_item_created_by_handle_foreign',
      'created_by_handle',
      'person_item',
    );
    this.replaceForeignKey(
      'event_azure_item',
      'event_azure_item_event_handle_foreign',
      'event_handle',
      'event_item',
    );
    this.replaceForeignKey(
      'event_google_item',
      'event_google_item_event_handle_foreign',
      'event_handle',
      'event_item',
    );
    this.replaceForeignKey(
      'event_delivery_item',
      'event_delivery_item_event_handle_foreign',
      'event_handle',
      'event_item',
    );
  }

  override down(): void {
    this.restoreForeignKey(
      'inbox_notification_item',
      'inbox_notification_item_recipient_person_handle_foreign',
      'recipient_person_handle',
      'person_item',
    );
    this.restoreForeignKey(
      'inbox_notification_item',
      'inbox_notification_item_created_by_handle_foreign',
      'created_by_handle',
      'person_item',
    );
    this.restoreForeignKey(
      'event_azure_item',
      'event_azure_item_event_handle_foreign',
      'event_handle',
      'event_item',
    );
    this.restoreForeignKey(
      'event_google_item',
      'event_google_item_event_handle_foreign',
      'event_handle',
      'event_item',
    );
    this.restoreForeignKey(
      'event_delivery_item',
      'event_delivery_item_event_handle_foreign',
      'event_handle',
      'event_item',
    );
  }

  private replaceForeignKey(
    table: string,
    constraint: string,
    column: string,
    referencedTable: string,
  ): void {
    this.addSql(
      `alter table "${table}" drop constraint if exists "${constraint}";`,
    );
    this.addSql(
      `alter table "${table}" add constraint "${constraint}" foreign key ("${column}") references "${referencedTable}" ("handle") on delete cascade;`,
    );
  }

  private restoreForeignKey(
    table: string,
    constraint: string,
    column: string,
    referencedTable: string,
  ): void {
    this.addSql(
      `alter table "${table}" drop constraint if exists "${constraint}";`,
    );
    this.addSql(
      `alter table "${table}" add constraint "${constraint}" foreign key ("${column}") references "${referencedTable}" ("handle");`,
    );
  }
}
