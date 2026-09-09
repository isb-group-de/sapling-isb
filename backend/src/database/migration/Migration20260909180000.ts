import { Migration } from '@mikro-orm/migrations';

export class Migration20260909180000 extends Migration {
  override up(): void {
    for (const [table, field, target] of [
      ['event_item', 'internal_case_handle', 'internal_case_item'],
      ['event_item', 'effort_estimate_handle', 'effort_estimate_item'],
      ['internal_case_item', 'effort_estimate_handle', 'effort_estimate_item'],
    ]) {
      this.addSql(`alter table "${table}" add column "${field}" int null;`);
      this.addSql(
        `alter table "${table}" add constraint "${table}_${field}_foreign" foreign key ("${field}") references "${target}" ("handle") on update cascade on delete set null;`,
      );
      this.addSql(
        `create index "${table}_${field}_index" on "${table}" ("${field}");`,
      );
    }
  }

  override down(): void {
    this.addSql(
      'alter table "event_item" drop column "internal_case_handle", drop column "effort_estimate_handle";',
    );
    this.addSql(
      'alter table "internal_case_item" drop column "effort_estimate_handle";',
    );
  }
}
