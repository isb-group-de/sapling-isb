// Run from backend after building the unmodified application. Sources are read-only.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const { Client } = require('pg');
const { MikroORM } = require('@mikro-orm/postgresql');
const config = require('../../dist/database/mikro-orm.config').default;

async function main() {
  const output = path.resolve('../test-results/database-baseline');
  if (fs.existsSync(path.join(output, 'capture.json')))
    throw new Error(
      'A reference capture already exists; refusing to overwrite it.',
    );
  if (
    !fs.existsSync(
      'src/database/seeder/json-production/person/personData_001.json',
    )
  ) {
    throw new Error(
      'Capture must run against the pre-consolidation source tree. See maintenance/baseline/README.md.',
    );
  }
  fs.mkdirSync(output, { recursive: true });
  const orm = await MikroORM.init({ ...config, debug: false });
  try {
    const registry =
      require('../../dist/entity/global/entity.registry').ENTITY_REGISTRY;
    const entities = registry.map(({ name, class: entity }) => {
      const meta = orm.getMetadata().get(entity.name);
      return {
        name,
        className: entity.name,
        table: meta.tableName,
        primaryKeys: meta.primaryKeys,
        properties: meta.props
          .filter((p) => p.persist !== false)
          .map((p) => ({
            name: p.name,
            kind: p.kind,
            fieldNames: p.fieldNames,
            type: p.type,
            owner: p.owner,
            pivotTable: p.pivotTable,
            joinColumns: p.joinColumns,
            inverseJoinColumns: p.inverseJoinColumns,
            nullable: p.nullable,
            primary: p.primary,
            autoincrement: p.autoincrement,
          })),
      };
    });
    const snapshots = {};
    for (const [dataset, database] of Object.entries({
      demonstration: 'sapling',
      production: 'sapling_empty',
    })) {
      const dump = path.join(output, `${database}.dump`);
      if (!fs.existsSync(dump)) {
        const executable =
          process.env.PG_DUMP_PATH ||
          (process.platform === 'win32'
            ? 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe'
            : 'pg_dump');
        const result = spawnSync(
          executable,
          ['--format=custom', '--no-owner', '--no-acl', '--file', dump],
          {
            env: {
              ...process.env,
              PGHOST: process.env.DB_HOST,
              PGPORT: process.env.DB_PORT || '5432',
              PGUSER: process.env.DB_USER,
              PGPASSWORD: process.env.DB_PASSWORD,
              PGDATABASE: database,
            },
            encoding: 'utf8',
            windowsHide: true,
          },
        );
        if (result.status !== 0)
          throw new Error(
            `Backup failed for ${dataset}: ${result.error?.message || result.stderr}`,
          );
      }
      const client = new Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database,
      });
      await client.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL TIME ZONE 'UTC'");
        const tables = (
          await client.query(
            "select tablename from pg_tables where schemaname='public' order by tablename",
          )
        ).rows;
        const data = {};
        for (const { tablename } of tables) {
          if (!/^[a-z_][a-z0-9_]*$/.test(tablename))
            throw new Error('Unexpected table name');
          data[tablename] = (
            await client.query(
              `select row_to_json(t) as row from "${tablename}" t`,
            )
          ).rows.map((r) => r.row);
        }
        const catalog = (
          await client.query(
            fs.readFileSync('src/database/baseline/schema-catalog.sql', 'utf8'),
          )
        ).rows;
        const schemaHash = createHash('sha256')
          .update(JSON.stringify(catalog))
          .digest('hex');
        snapshots[dataset] = { database, data, schemaHash, catalog };
        if (dataset === 'production') {
          const result = spawnSync(
            process.env.PG_DUMP_PATH ||
              (process.platform === 'win32'
                ? 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe'
                : 'pg_dump'),
            [
              '--schema-only',
              '--no-owner',
              '--no-acl',
              '--exclude-table=public.mikro_orm_migrations*',
            ],
            {
              env: {
                ...process.env,
                PGHOST: process.env.DB_HOST,
                PGPORT: process.env.DB_PORT || '5432',
                PGUSER: process.env.DB_USER,
                PGPASSWORD: process.env.DB_PASSWORD,
                PGDATABASE: database,
              },
              encoding: 'utf8',
              windowsHide: true,
              maxBuffer: 8 * 1024 * 1024,
            },
          );
          if (result.status !== 0) throw new Error('Schema export failed');
          fs.writeFileSync(path.join(output, 'schema.sql'), result.stdout);
        }
        await client.query('ROLLBACK');
        console.log(
          JSON.stringify({
            dataset,
            tables: tables.length,
            schemaHash,
            backupBytes: fs.statSync(dump).size,
          }),
        );
      } finally {
        await client.end();
      }
    }
    const createSQL = await orm.schema.getCreateSchemaSQL({ wrap: false });
    const dropSQL = await orm.schema.getDropSchemaSQL({ wrap: false });
    fs.writeFileSync(
      path.join(output, 'capture.json'),
      JSON.stringify({ entities, snapshots, createSQL, dropSQL }),
    );
    // Retain the original dependency order and bootstrap credentials before replacing seeds.
    fs.copyFileSync(
      'src/database/seeder/DatabaseSeeder.ts',
      path.join(output, 'DatabaseSeeder.before.ts'),
    );
    for (const dataset of ['production', 'demonstration']) {
      fs.copyFileSync(
        `src/database/seeder/json-${dataset}/person/personData_001.json`,
        path.join(output, `${dataset}-person.json`),
      );
    }
  } finally {
    await orm.close(true);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
