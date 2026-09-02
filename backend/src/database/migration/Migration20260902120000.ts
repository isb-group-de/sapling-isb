import { Migration } from '@mikro-orm/migrations';

/**
 * Make the Partner workspace the default destination for existing worklists
 * of the four partner-oriented business entities.
 *
 * Deliberately configured alternative views such as Kanban remain unchanged.
 */
export class Migration20260902120000 extends Migration {
  override up(): void {
    for (const table of WORKLIST_TABLES) {
      this.addSql(
        `update "${table}" as worklist
         set "entity_route_handle" = partner_route."handle", "updated_at" = now()
         from "entity_route_item" as partner_route
         where worklist."entity_handle" in (${PARTNER_ENTITY_HANDLES_SQL})
           and partner_route."entity_handle" = worklist."entity_handle"
           and partner_route."route" = 'partner/' || worklist."entity_handle"
           and partner_route."group_handle" is null
           and (
             worklist."entity_route_handle" is null
             or exists (
               select 1
               from "entity_route_item" as current_route
               where current_route."handle" = worklist."entity_route_handle"
                 and current_route."route" = 'table/' || worklist."entity_handle"
             )
           );`,
      );
    }
  }

  override down(): void {
    // The previous route cannot be reconstructed reliably after this data
    // correction. Intentionally leave the corrected worklist routes in place.
  }
}

const WORKLIST_TABLES = ['favorite_item', 'favorite_template_item'] as const;

const PARTNER_ENTITY_HANDLES_SQL = [
  'effortEstimate',
  'internalCase',
  'salesOpportunity',
  'ticket',
  'event',
]
  .map((handle) => `'${handle}'`)
  .join(', ');
