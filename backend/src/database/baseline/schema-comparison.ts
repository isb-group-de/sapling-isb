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
