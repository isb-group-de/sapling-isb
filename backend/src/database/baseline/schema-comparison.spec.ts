import {
  compareSchema,
  formatSchemaDifferences,
  schemaHash,
  normalizeSchemaCatalog,
} from './schema-comparison';

describe('Baseline schema diagnostics', () => {
  it('normalizes only redundant plain NOT NULL catalog entries', () => {
    const column = { key: 'column:person:name', value: 'varchar(64)|true|||' };
    const extra = [
      { key: 'constraint:person:any_name', value: 'NOT NULL name' },
      { key: 'constraint:person:quoted', value: 'NOT NULL "name"' },
    ];
    expect(normalizeSchemaCatalog([column, ...extra])).toEqual([column]);
    const quotedColumn = {
      key: 'column:person:display"Name',
      value: 'text|true|||',
    };
    expect(
      normalizeSchemaCatalog([
        quotedColumn,
        { key: 'constraint:person:quoted', value: 'NOT NULL "display""Name"' },
      ]),
    ).toEqual([quotedColumn]);
  });

  it('keeps unsupported or nonredundant constraints for diagnosis', () => {
    const rows = [
      { key: 'column:person:name', value: 'text|false|||' },
      { key: 'constraint:person:nullable', value: 'NOT NULL name' },
      { key: 'constraint:person:missing', value: 'NOT NULL missing_column' },
      {
        key: 'constraint:person:name_not_null',
        value: 'CHECK (name IS NOT NULL)',
      },
      {
        key: 'constraint:person:foreign',
        value: 'FOREIGN KEY (role) REFERENCES role(handle)',
      },
      { key: 'column:person:handle', value: 'integer|true|||' },
      { key: 'constraint:person:special', value: 'NOT NULL handle NO INHERIT' },
      {
        key: 'constraint:person:unvalidated',
        value: 'NOT NULL handle NOT VALID',
      },
    ];
    expect(normalizeSchemaCatalog(rows)).toEqual(rows);
  });

  it('identifies missing, additional and changed definitions', () => {
    const differences = compareSchema(
      [
        { key: 'column:person:name', value: 'varchar(64)' },
        { key: 'extension:vector', value: 'vector' },
      ],
      [
        { key: 'column:person:name', value: 'varchar(128)' },
        { key: 'index:person:custom', value: 'CREATE INDEX custom' },
      ],
    );
    expect(differences).toEqual([
      {
        key: 'column:person:name',
        expected: ['varchar(64)'],
        actual: ['varchar(128)'],
      },
      { key: 'extension:vector', expected: ['vector'], actual: [] },
      {
        key: 'index:person:custom',
        expected: [],
        actual: ['CREATE INDEX custom'],
      },
    ]);
    const message = formatSchemaDifferences(differences);
    expect(message).toContain('Changed column:person:name');
    expect(message).toContain('Expected: ["varchar(64)"]');
    expect(message).toContain('Actual:   ["varchar(128)"]');
    expect(message).toContain('Missing extension:vector');
    expect(message).toContain('Additional index:person:custom');
  });

  it('compares all definitions of a key without dropping duplicates', () => {
    const rows = [
      { key: 'function:trigger', value: 'one' },
      { key: 'function:trigger', value: 'two' },
    ];
    expect(compareSchema(rows, [...rows].reverse())).toEqual([]);
    expect(compareSchema(rows, [rows[0]])).toHaveLength(1);
    expect(compareSchema(rows, [...rows, rows[0]])).toHaveLength(1);
  });

  it('does not silently normalize SQL text or line endings', () => {
    const before = [{ key: 'function:trigger', value: 'BEGIN\nEND' }];
    const after = [{ key: 'function:trigger', value: 'BEGIN\r\nEND' }];
    expect(schemaHash(before)).not.toBe(schemaHash(after));
    expect(compareSchema(before, after)).toHaveLength(1);
  });

  it('explains an order-only fingerprint mismatch', () => {
    const rows = [
      { key: 'a', value: 'one' },
      { key: 'b', value: 'two' },
    ];
    const reversed = [...rows].reverse();
    expect(schemaHash(rows)).not.toBe(schemaHash(reversed));
    expect(formatSchemaDifferences(compareSchema(rows, reversed))).toContain(
      'catalog order differs',
    );
  });
});
