import { Migration } from '@mikro-orm/migrations';

/** Add open-state and explicit ordering metadata to status chip catalogs. */
export class Migration20260902080000 extends Migration {
  override up(): void {
    for (const table of STATUS_TABLES_WITH_OPEN_AND_SORT) {
      this.addSql(
        `alter table "${table}" add column "is_open" boolean not null default true, add column "sort_order" int not null default 100;`,
      );
    }

    for (const table of STATUS_TABLES_WITH_NEW_SORT) {
      this.addSql(
        `alter table "${table}" add column "sort_order" int not null default 100;`,
      );
    }

    for (const table of STATUS_TABLES_WITH_NEW_OPEN) {
      this.addSql(
        `alter table "${table}" add column "is_open" boolean not null default true;`,
      );
    }

    for (const [table, labelColumn] of STATUS_CATALOGS) {
      this.addSql(
        `with ordered as (
           select "handle", row_number() over (order by lower("${labelColumn}"), "handle") * 10 as "position"
           from "${table}"
         )
         update "${table}" as status
         set "sort_order" = ordered."position"
         from ordered
         where status."handle" = ordered."handle";`,
      );
    }

    for (const [table, closedHandles] of CLOSED_STATUS_HANDLES) {
      this.addSql(
        `update "${table}" set "is_open" = false where "handle" in (${closedHandles
          .map((handle) => `'${handle}'`)
          .join(', ')});`,
      );
    }
  }

  override down(): void {
    for (const table of STATUS_TABLES_WITH_OPEN_AND_SORT) {
      this.addSql(
        `alter table "${table}" drop column "is_open", drop column "sort_order";`,
      );
    }

    for (const table of STATUS_TABLES_WITH_NEW_SORT) {
      this.addSql(`alter table "${table}" drop column "sort_order";`);
    }

    for (const table of STATUS_TABLES_WITH_NEW_OPEN) {
      this.addSql(`alter table "${table}" drop column "is_open";`);
    }

    // Existing sortOrder/isOpen values cannot be reconstructed reliably.
  }
}

const STATUS_TABLES_WITH_OPEN_AND_SORT = [
  'effort_estimate_status_item',
  'email_delivery_status_item',
  'event_delivery_status_item',
  'inbound_email_status_item',
  'teams_delivery_status_item',
  'webhook_delivery_status_item',
] as const;

const STATUS_TABLES_WITH_NEW_SORT = [
  'event_status_item',
  'internal_case_status_item',
  'ticket_status_item',
] as const;

const STATUS_TABLES_WITH_NEW_OPEN = [
  'knowledge_article_status_item',
  'marketing_campaign_status_item',
  'sales_opportunity_stage_item',
] as const;

const STATUS_CATALOGS = [
  ['effort_estimate_status_item', 'description'],
  ['email_delivery_status_item', 'description'],
  ['event_delivery_status_item', 'description'],
  ['event_status_item', 'description'],
  ['inbound_email_status_item', 'description'],
  ['internal_case_status_item', 'description'],
  ['knowledge_article_status_item', 'description'],
  ['marketing_campaign_status_item', 'title'],
  ['sales_opportunity_result_status_item', 'title'],
  ['sales_opportunity_stage_item', 'title'],
  ['teams_delivery_status_item', 'description'],
  ['ticket_status_item', 'description'],
  ['webhook_delivery_status_item', 'description'],
] as const;

const CLOSED_STATUS_HANDLES = [
  ['effort_estimate_status_item', ['cancelled', 'completed']],
  ['email_delivery_status_item', ['failed', 'success']],
  ['event_delivery_status_item', ['failed', 'retried', 'success']],
  ['event_status_item', ['canceled', 'completed']],
  ['inbound_email_status_item', ['failed', 'processed']],
  ['internal_case_status_item', ['cancelled', 'completed']],
  ['knowledge_article_status_item', ['archived']],
  ['marketing_campaign_status_item', ['canceled', 'completed']],
  ['sales_opportunity_result_status_item', ['lost', 'won']],
  ['sales_opportunity_stage_item', ['lost', 'won']],
  ['teams_delivery_status_item', ['failed', 'success']],
  ['ticket_status_item', ['closed']],
  ['webhook_delivery_status_item', ['failed', 'retried', 'success']],
] as const;
