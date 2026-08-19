import { Migration } from '@mikro-orm/migrations';

export class Migration20260819140000 extends Migration {
  override up(): void {
    this.addSql(
      `alter table "ai_agent_run_item"
       alter column "duration_ms" type integer
       using (
         case
           when "duration_ms" is null or btrim("duration_ms") = '' then null
           when btrim("duration_ms") ~ '^[0-9]+$'
             and btrim("duration_ms")::numeric <= 2147483647
             then btrim("duration_ms")::integer
           else null
         end
       );`,
    );
  }

  override down(): void {
    this.addSql(
      `alter table "ai_agent_run_item"
       alter column "duration_ms" type varchar(255)
       using "duration_ms"::varchar(255);`,
    );
  }
}
