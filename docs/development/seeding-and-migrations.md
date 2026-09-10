# Seeders, Migrations, And Reference Data

Sapling uses one shared schema and explicit, versioned data operations. The September
2026 baseline consolidates the fully deployed databases through
`Migration20260910103733`. Existing installations must adopt that baseline once;
fresh installations execute it normally.

## Shared Defaults And Environment Data

`DB_DATA_SEEDER=production|demonstration` selects one environment. Every run loads
`json-default` plus that environment, never both environments:

```text
backend/src/database/seeder/json-default/
backend/src/database/seeder/json-production/
backend/src/database/seeder/json-demonstration/
```

Shared reference data, permissions and translations belong in `json-default`.
Production contains its service user and actual production-only differences.
Demonstration contains test users, business records and explicit changes to defaults.
Omit empty environment folders/files. Do not duplicate shared data in both datasets.
Switching the dataset of an initialized database is rejected; such a conversion
requires a separate data migration.

## Filenames And Operations

```text
{entityHandle}/{entityHandle}Data_NNNN_insert.json
{entityHandle}/{entityHandle}Data_NNNN_update.json
{entityHandle}/{entityHandle}Data_NNNN_delete.json
```

Use four digits starting at `0001`. A number identifies one operation within one
entity folder and scope. Default and environment files can share a number because
their complete paths differ. For new work, choose the next number above the highest
existing number for that entity across all three scopes; do not fill historical gaps.
Legacy names, unknown operations, zero and duplicate numbers within a folder fail
validation rather than silently being ignored.

Each file contains a JSON array and performs only its named operation:

```json
[
  { "entity": "ticket", "property": "title", "language": "de", "value": "Titel" }
]
```

The preceding example is a translation **insert**. Updates explicitly separate the
selector from changed values:

```json
[
  {
    "key": { "entity": "ticket", "property": "title", "language": "de" },
    "values": { "value": "Bezeichnung" }
  }
]
```

Deletes contain only the selector:

```json
[
  { "key": { "entity": "ticket", "property": "obsoleteLabel", "language": "de" } }
]
```

- Insert creates a missing record and leaves an existing identity unchanged.
- Update changes only supplied fields; a missing target is skipped. Omitted fields
  remain unchanged; explicit `null` clears a nullable field. Primary keys cannot change.
- Delete removes the named record; a missing target is skipped. Database foreign
  keys, configured delete rules and immutable-version triggers remain enforced.
- Skips are successful outcomes, reported separately from actual changes.
- Empty selectors, filter operators, unsupported fields and ambiguous matches fail.
- No operation falls back to a different operation. There is no upsert.

Keys may use the complete primary key, a declared unique key, or a supported
logical identity: translations use `entity + property + language`, permissions use
`entity + role`, routes use `entity + route + group`, dashboard templates use
`name + person`, and prompt versions use `template + version`. Nullable identity
components must be explicit, for example `group: null`.

Inserts use an explicit primary key first, otherwise a supported complete logical
or unique key. Without a stable supplied identity they remain additive, protected
against reruns by file tracking. Relation values are primary keys; collection
values are arrays of primary keys. Seed operations never implicitly create referenced
records. Phone normalization, entity hooks and prompt validation still apply.

## Dependency Order And Tracking

`DatabaseSeeder` uses `seed-order.json` to schedule every file exactly once. Within
each phase it executes Default before the selected environment, numerically within
each scope. The baseline's first phases run numbers through `0002`; subsequent
phases run numbers after `0002`, including deferred relations and future changes.
The phase ranges are explicit and can be adjusted when a new dependency requires it.

Register new seeded entities in the central entity registry and dependency schedule.
Check dependencies for both fresh and already initialized databases: languages
precede translations; roles and entities precede permissions; persons precede their
dashboard templates. Deferred relation updates run after their referenced rows exist.
For example, prompt templates are inserted with no active version, versions are
inserted next, and a later template update sets the published-version reference.

Permissions and role starter assignments are ordinary explicit seed operations.
There is no automatic permission generation, administrator resynchronization,
role-template replacement or prompt-draft update on every deployment. New entities
need explicit permission insert files; capability changes may need explicit permission
updates. Published prompt versions remain immutable; new content requires a new version.

Successful files are recorded in `seed_script_item` by `entityHandle` and the full
relative `scriptName`, for example
`json-default/translation/translationData_0001_insert.json`. An advisory lock and
one transaction cover the entire seed run, including its success records. Errors
roll back the run; existing inserts and missing update/delete targets are deliberate
no-ops. Lookups are batched, and serial sequences advance after explicit ID inserts
without being rewound. PostgreSQL sequence gaps after rollbacks are normal.

Environment changes are one-time scripts, not permanently reapplied overrides.
When a new Default script changes a field with an environment-specific value,
ship a new environment update in the same release if that difference must remain.

## Consolidated Migration

The only baseline migration is `Migration20260708104812`. Its filename and class
retain the original identity so existing installations do not run it again.
Its first SQL statement is always:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The migration also includes `pg_trgm`, exact indexes and constraints, sequences,
the prompt protection function and its trigger. It was derived from the verified
PostgreSQL 18 schema; historical data patches are represented in the final seeds.
Tracking cleanup deliberately lives in the adoption code, not in this migration,
which is skipped by existing installations.

The entity metadata remains the schema source for future changes. Declare indexes,
unique constraints, relation rules and database defaults there. Extension operator
classes must be explicit (the search index uses `gin_trgm_ops`). The shared ORM
snapshot remains `backend/src/database/migration/.snapshot-sapling.json`, independent
of `DB_NAME`. Never create per-database snapshots.
`snapshotOnMigrate=false` keeps deployments and integration migrations from
rewriting this versioned authoring snapshot; only migration creation updates it.

Create future migrations with `npm run orm:create-migration --prefix backend`.
Review the SQL and run the command again: it must report no schema changes. After
baseline release, migration and seed history is additive again. Do not edit or
renumber released baseline files or regenerate their manifest to distribute changes.

## Adopt An Existing Database Once

1. Deploy the old history completely through the baseline cutoff on each system.
2. Back up the database and stop application processes that can write to it.
3. Install the consolidated release and set `DB_BASELINE_ADOPT=true` in the backend
   environment. The default is `false`; adoption requires `UPDATE_MODE=all`.
4. Run `npm run orm:deploy --prefix backend` (or the deployment system's equivalent).
5. Verify the resulting tracking records, set the flag back to `false`, and restart
   the application.

Before migration/seeding, adoption checks the complete old migration list, successful
seed history for the selected dataset, frozen baseline files and schema fingerprint.
The old role-starter files were not tracked and therefore are not required as old
history entries; their final assignments are included in the new baseline.

In one locked transaction it preserves the original migration row, deletes all other
migration history, clears `seed_script_item`, records the frozen Default and selected
environment baseline files as successful, and writes a durable `__baseline` marker.
It executes no application data operations. Later files are never included merely
because they exist on disk: only the frozen manifest is adopted.

Incomplete, unknown/newer legacy histories, changed schemas and incorrect dataset
selection fail before cleanup. An old database without the flag fails with instructions.
A retained `true` flag on an already adopted database does not clear anything again;
normal new migrations and seeds still run. Fresh databases use `false`, execute the
baseline and write the same dataset-specific completion marker after successful seeding.

Restoring across this history cut requires the database backup and matching old code;
reverting Git alone cannot restore discarded migration/seed history.

## Verification And Source Snapshots

The consolidation used `sapling` (demonstration) and `sapling_empty` (production),
both immediately after the old `orm:deploy`. Local backups and comparison artifacts
are kept outside tracked source under `test-results/database-baseline`.

`backend/maintenance/baseline/verify.cjs` builds disposable fresh and restored-copy
databases for both datasets. It compares every application table and relation,
exact schema catalog, adoption preservation and repeat behavior. Fresh-install
comparisons ignore creation/update/publication audit times and generated translation/
permission surrogate IDs; their complete logical keys/values and all actual relation
identities are compared. The captured sources have no field-permission records that
reference permission IDs. Adoption retains all original IDs unchanged.
Password hashes are checked separately against the original bootstrap credentials.
Adoption comparisons include every application field, including audit times and hashes.

Run backend typecheck, focused seed tests and the database verifier. Also verify
foreign-key failures, immutable prompts, transaction rollback, malformed selectors,
sequence advancement, new post-baseline migrations/seeds and repeated adoption.
Source databases are not replaced by the verifier.
