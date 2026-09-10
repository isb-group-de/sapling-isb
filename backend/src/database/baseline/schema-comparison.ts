import { createHash } from 'node:crypto';

export type SchemaEntry = { key: string; value: string };
export type SchemaDifference = {
  key: string;
  expected: string[];
  actual: string[];
};

export function schemaHash(rows: SchemaEntry[]): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

/** PostgreSQL 18 additionally catalogs named NOT NULL constraints.
 * Column attnotnull already carries the same rule on all supported versions.
 * Remove only plain duplicate definitions whose column is present and NOT NULL;
 * unusual definitions (e.g. NOT VALID / NO INHERIT) remain subject to comparison.
 */
export function normalizeSchemaCatalog(rows: SchemaEntry[]): SchemaEntry[] {
  const columns = new Map(
    rows
      .filter((row) => row.key.startsWith('column:'))
      .map((row) => [row.key, row.value]),
  );
  return rows.filter((row) => {
    const table = /^constraint:([^:]+):/.exec(row.key)?.[1];
    const column =
      /^NOT NULL (?:"((?:[^"]|"")+)"|([a-zA-Z_][a-zA-Z0-9_$]*))$/.exec(
        row.value,
      );
    if (!table || !column) return true;
    const name =
      column[1] !== undefined ? column[1].replace(/""/g, '"') : column[2];
    return columns.get(`column:${table}:${name}`)?.split('|')[1] !== 'true';
  });
}

export function compareSchema(
  expected: SchemaEntry[],
  actual: SchemaEntry[],
): SchemaDifference[] {
  const group = (rows: SchemaEntry[]) => {
    const result = new Map<string, string[]>();
    for (const row of rows)
      result.set(row.key, [...(result.get(row.key) || []), row.value]);
    for (const values of result.values()) values.sort();
    return result;
  };
  const left = group(expected),
    right = group(actual);
  return [...new Set([...left.keys(), ...right.keys()])]
    .sort()
    .flatMap((key) => {
      const expectedValues = left.get(key) || [],
        actualValues = right.get(key) || [];
      return JSON.stringify(expectedValues) === JSON.stringify(actualValues)
        ? []
        : [{ key, expected: expectedValues, actual: actualValues }];
    });
}

export function formatSchemaDifferences(
  differences: SchemaDifference[],
): string {
  if (!differences.length)
    return 'Definitions match, but their serialized catalog order differs.';
  return differences
    .map(
      ({ key, expected, actual }) =>
        `${!expected.length ? 'Additional' : !actual.length ? 'Missing' : 'Changed'} ${key}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`,
    )
    .join('\n');
}
