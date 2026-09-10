# Baseline consolidation verification

Run commands from `backend`. These tools use the configured PostgreSQL connection;
the source database names are `sapling` (demo) and `sapling_empty` (production).
They do not alter either source database.

- `capture.cjs` is a **one-time pre-consolidation tool**. It requires the old
  source seed tree and the schema-catalog query supplied by this change. It creates
  backups and a reference capture in the Git-ignored
  `test-results/database-baseline` directory. It refuses to replace an existing
  capture. Do not run it against the released consolidated seed tree.
- `generate.cjs --replace-baseline` rebuilds the consolidated seeds, manifest and
  initial migration from that capture. It replaces the scoped seed directories
  and migration files. This is not a regular deployment or future-change command;
  do not use it after the baseline has been released.
- `verify.cjs` provisions fresh databases and restored backup copies with names
  `sapling_baseline_{production|demonstration}_{fresh|adopt}_test`, then compares
  their schema, data, credentials, tracking and repeat behavior. It also checks
  rejection of missing history and schema drift. Only test databases recorded in
  the local ownership file may be replaced on later runs.
- `exercise.cjs` runs after `verify.cjs`. It exercises insert/update/delete,
  protected prompts, foreign keys, transaction rollback, sequences, new scripts
  and new migrations. It deliberately changes the disposable production test
  database, and removes its temporary files from `dist` in `finally` blocks.

Typical final validation:

```sh
npm run build
node maintenance/baseline/verify.cjs
node maintenance/baseline/exercise.cjs
```

PostgreSQL clients must match the server major version. Windows defaults to
`C:/Program Files/PostgreSQL/18/bin`; other platforms use `PATH`. Override
`PG_DUMP_PATH` and `PG_RESTORE_PATH` when necessary. The database user needs
permission to create the disposable test databases. Credentials are inherited
from the existing backend environment, never passed as command-line arguments.

Backups, detailed logs and comparison output remain local and ignored by Git.
Keep the reference capture until rollout is complete. Baseline adoption itself is
implemented in `src/database/baseline` and does not require these maintenance tools
or the local reference capture on deployed systems.
