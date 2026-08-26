import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { DatabaseDto, DatabaseTableDto } from '../dto/database.dto';

type DatabaseInfoRow = {
  name: string;
  version: string;
  schema: string;
  size: number | string;
  activeConnections: number | string;
  maxConnections: number | string;
  startedAt: Date | string;
  tableCount: number | string;
  largestTables: DatabaseTableDto[] | string;
};

@Injectable()
export class DatabaseService {
  constructor(private readonly em: EntityManager) {}

  async getDatabase(): Promise<DatabaseDto> {
    const rows = (await this.em.getConnection().execute(`
      WITH table_sizes AS (
        SELECT
          namespace.nspname AS "schema",
          relation.relname AS "name",
          pg_total_relation_size(relation.oid)::float8 AS "size"
        FROM pg_class relation
        INNER JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE relation.relkind IN ('r', 'p')
          AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
          AND namespace.nspname NOT LIKE 'pg_toast%'
      )
      SELECT
        current_database() AS "name",
        current_setting('server_version') AS "version",
        current_schema() AS "schema",
        pg_database_size(current_database())::float8 AS "size",
        (
          SELECT count(*)::int
          FROM pg_stat_activity
          WHERE datname = current_database()
        ) AS "activeConnections",
        current_setting('max_connections')::int AS "maxConnections",
        pg_postmaster_start_time() AS "startedAt",
        (SELECT count(*)::int FROM table_sizes) AS "tableCount",
        COALESCE(
          (
            SELECT json_agg(largest_table)
            FROM (
              SELECT "schema", "name", "size"
              FROM table_sizes
              ORDER BY "size" DESC, "schema", "name"
              LIMIT 9
            ) largest_table
          ),
          '[]'::json
        ) AS "largestTables"
    `)) as DatabaseInfoRow[];
    const row = rows[0];
    const largestTables =
      typeof row.largestTables === 'string'
        ? (JSON.parse(row.largestTables) as DatabaseTableDto[])
        : row.largestTables;

    return {
      engine: 'PostgreSQL',
      name: row.name,
      version: row.version,
      schema: row.schema,
      size: Number(row.size),
      activeConnections: Number(row.activeConnections),
      maxConnections: Number(row.maxConnections),
      startedAt: new Date(row.startedAt).toISOString(),
      tableCount: Number(row.tableCount),
      largestTables: largestTables.map((table) => ({
        schema: table.schema,
        name: table.name,
        size: Number(table.size),
      })),
    };
  }

  async getDatabaseTables(): Promise<DatabaseTableDto[]> {
    const rows = (await this.em.getConnection().execute(`
      SELECT
        namespace.nspname AS "schema",
        relation.relname AS "name",
        pg_total_relation_size(relation.oid)::float8 AS "size"
      FROM pg_class relation
      INNER JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE relation.relkind IN ('r', 'p')
        AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
        AND namespace.nspname NOT LIKE 'pg_toast%'
      ORDER BY "size" DESC, "schema", "name"
    `)) as DatabaseTableDto[];

    return rows.map((table) => ({
      schema: table.schema,
      name: table.name,
      size: Number(table.size),
    }));
  }
}
