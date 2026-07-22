import { Migration } from '@mikro-orm/migrations';

export class Migration20260722120000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "email_delivery_item" add column "customer_company_handle" int null, add column "customer_person_handle" int null;`,
    );
    this.addSql(
      `create index "email_delivery_item_customer_company_handle_index" on "email_delivery_item" ("customer_company_handle");`,
    );
    this.addSql(
      `create index "email_delivery_item_customer_person_handle_index" on "email_delivery_item" ("customer_person_handle");`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_customer_company_handle_foreign" foreign key ("customer_company_handle") references "company_item" ("handle") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "email_delivery_item" add constraint "email_delivery_item_customer_person_handle_foreign" foreign key ("customer_person_handle") references "person_item" ("handle") on update cascade on delete set null;`,
    );

    this.addSql(
      `update "email_delivery_item" d set "customer_company_handle" = d."reference_handle"::int where d."entity_handle" = 'company' and d."reference_handle" ~ '^[0-9]+$';`,
    );
    this.addSql(
      `update "email_delivery_item" d set "customer_person_handle" = p."handle", "customer_company_handle" = p."company_handle" from "person_item" p where d."entity_handle" = 'person' and d."reference_handle" ~ '^[0-9]+$' and p."handle" = d."reference_handle"::int;`,
    );
    this.addSql(
      `update "email_delivery_item" d set "customer_company_handle" = t."creator_company_handle", "customer_person_handle" = t."creator_person_handle" from "ticket_item" t where d."entity_handle" = 'ticket' and d."reference_handle" ~ '^[0-9]+$' and t."handle" = d."reference_handle"::int;`,
    );
    this.addSql(
      `update "email_delivery_item" d set "customer_company_handle" = s."creator_company_handle", "customer_person_handle" = s."creator_person_handle" from "sales_opportunity_item" s where d."entity_handle" = 'salesOpportunity' and d."reference_handle" ~ '^[0-9]+$' and s."handle" = d."reference_handle"::int;`,
    );
    this.addSql(
      `update "email_delivery_item" d set "customer_company_handle" = e."creator_company_handle", "customer_person_handle" = e."creator_person_handle" from "effort_estimate_item" e where d."entity_handle" = 'effortEstimate' and d."reference_handle" ~ '^[0-9]+$' and e."handle" = d."reference_handle"::int;`,
    );
    this.addSql(
      `update "email_delivery_item" d set "customer_company_handle" = e."creator_company_handle", "customer_person_handle" = e."creator_person_handle" from "event_item" e where d."entity_handle" = 'event' and d."reference_handle" ~ '^[0-9]+$' and e."handle" = d."reference_handle"::int;`,
    );
    this.addSql(
      `update "email_delivery_item" d set "customer_company_handle" = c."company_handle" from "contract_item" c where d."entity_handle" = 'contract' and d."reference_handle" ~ '^[0-9]+$' and c."handle" = d."reference_handle"::int;`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "email_delivery_item" drop constraint if exists "email_delivery_item_customer_company_handle_foreign";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop constraint if exists "email_delivery_item_customer_person_handle_foreign";`,
    );
    this.addSql(
      `drop index if exists "email_delivery_item_customer_company_handle_index";`,
    );
    this.addSql(
      `drop index if exists "email_delivery_item_customer_person_handle_index";`,
    );
    this.addSql(
      `alter table "email_delivery_item" drop column if exists "customer_company_handle", drop column if exists "customer_person_handle";`,
    );
  }
}
