import { EntityManager } from '@mikro-orm/core';

export type SqlRow = Record<string, unknown>;

export async function executeRows(
  em: EntityManager,
  sql: string,
  parameters: unknown[] = [],
): Promise<SqlRow[]> {
  const result: unknown = await em.getConnection().execute(sql, parameters);
  if (!Array.isArray(result)) return [];
  return result.filter(isSqlRow);
}

function isSqlRow(value: unknown): value is SqlRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
