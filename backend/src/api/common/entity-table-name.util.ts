import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';

const ENTITY_HANDLE_BY_TABLE_NAME = new Map(
  ENTITY_REGISTRY.map(({ name, class: entityClass }) => [
    classNameToTableName(entityClass.name),
    name,
  ]),
);

/**
 * Resolves a database table name to the public Sapling entity handle.
 *
 * PostgreSQL identifiers belong in diagnostics, while API consumers need the
 * stable handle so they can render the localized navigation label.
 */
export function getEntityHandleByTableName(
  tableName: string | undefined,
): string | undefined {
  if (!tableName) {
    return undefined;
  }

  return ENTITY_HANDLE_BY_TABLE_NAME.get(
    tableName.replace(/^.*\./, '').replaceAll('"', '').toLowerCase(),
  );
}

/** Mirrors MikroORM's default UnderscoreNamingStrategy. */
function classNameToTableName(className: string): string {
  return className.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}
