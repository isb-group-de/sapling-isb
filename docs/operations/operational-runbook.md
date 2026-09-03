# Operational Runbook

This runbook collects the day-to-day commands and checks for running Sapling locally or in a small self-hosted deployment. The root `README.md` remains the broad setup guide; `deploy/README.md` owns the complete Ubuntu installation and recovery workflow.

## System Shape

Sapling consists of:

- NestJS backend in `backend`
- Vue/Vite frontend in `frontend`
- PostgreSQL database, ideally with pgvector
- optional Redis for BullMQ queues
- local file storage under `backend/storage`
- backend logs under `backend/log` or the configured `LOG_OUTPUT_PATH`
- seed data under `backend/src/database/seeder/json-${DB_DATA_SEEDER}`

## Core Commands

From the repository root:

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend

npm run debug
npm run build
npm run verify
npm run orm:deploy
```

Backend-only:

```bash
npm run start:dev --prefix backend
npm run build --prefix backend
npm run test --prefix backend -- --runInBand
npm run orm:migrate --prefix backend
npm run orm:seed --prefix backend
npm run orm:deploy --prefix backend
```

Frontend-only:

```bash
npm run start:dev --prefix frontend
npm run build --prefix frontend
npm run test:unit --prefix frontend -- --run
npm run type-check --prefix frontend
```

## Environment Files

Create local environment files from defaults:

```bash
cp backend/.env.default backend/.env
cp frontend/.env.default frontend/.env
```

Minimum backend values to verify:

- `SAPLING_SECRET`
- `SAPLING_FRONTEND_URL`
- `API_REQUEST_BODY_LIMIT` for JSON/form requests such as script-button and AI contexts
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_POOL_MIN`, `DB_POOL_MAX`
- `DB_DATA_SEEDER`
- `SESSION_COOKIE_SECURE`
- `SESSION_TRUST_PROXY`
- `REDIS_ENABLED`
- `LOG_*`
- `SECURITY_PRINCIPAL_CACHE_TTL_MS`,
  `SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES`
- `GLOBAL_SEARCH_INDEX_ENABLED`
- `SAPLING_DEFAULT_PHONE_COUNTRY` and `SAPLING_DEFAULT_PHONE_DIALING_CODE` for
  phone number normalization when a user/company country is unavailable

Minimum frontend values to verify:

- `VITE_BACKEND_URL`
- `VITE_PORT`
- `VITE_SAPLING_DEFAULT_PHONE_COUNTRY` and
  `VITE_SAPLING_DEFAULT_PHONE_DIALING_CODE` for phone field formatting
- login visibility flags for Azure/Google if relevant

Never place secrets in `frontend/.env`; Vite exposes `VITE_*` values to the browser bundle.

## First Start

1. Install dependencies.
2. Start PostgreSQL.
3. Optionally start Redis.
4. Configure `backend/.env` and `frontend/.env`.
5. Run `npm run orm:deploy --prefix backend`.
6. Start the app with `npm run debug`.
7. Open frontend, backend API, and Swagger:

```text
http://localhost:5173
http://localhost:3000
http://localhost:3000/api/swagger
```

## Database Operations

Use migrations before seeders:

```bash
npm run orm:migrate --prefix backend
npm run orm:seed --prefix backend
```

For a fresh or updated environment, use:

```bash
npm run orm:deploy --prefix backend
```

The global command-palette search has an additive PostgreSQL trigram index.
After applying its migration, an administrator opens the account menu's
**Danger Zone**, selects **Rebuild search index**, and starts the background
rebuild. The dialog shows the current entity, processed record count, duration,
completion result, and a sanitized error message when a run fails. Closing the
dialog does not cancel the server-side job; reopening it resumes status polling.
The rebuild keeps the previous index readable and removes stale rows only after
the complete run succeeds.

Then set `GLOBAL_SEARCH_INDEX_ENABLED=true` and restart the backend. Keep the
flag false to fall back to the previous per-entity search implementation.
Generic record mutations maintain the index in the background; rerunning the
backfill is safe and reconciles records changed outside the generic mutation
path.

Seeder behavior:

- Seed files are selected from `json-${DB_DATA_SEEDER}`.
- Successful files are recorded in `seed_script_item`.
- Already successful files are skipped later.
- New reference data should be delivered in newly numbered JSON files.
- Translation seeding can update existing translations by handle/property semantics where the seeder supports it.

If a seed file must be rerun intentionally, inspect `seed_script_item` first and decide whether to remove only the matching script marker. Do not broadly truncate seed tracking in an environment with real data.

## Queue And Redis Operations

Redis is optional but recommended for asynchronous deliveries and retries.

When `REDIS_ENABLED=false`, some delivery flows execute directly or run without queue behavior.

When `REDIS_ENABLED=true`, verify:

- Redis host and port are reachable.
- Credentials match `REDIS_USERNAME` and `REDIS_PASSWORD`.
- retry settings are reasonable: `REDIS_ATTEMPTS`, `REDIS_BACKOFF_*`
- cleanup settings match operational needs: `REDIS_REMOVE_ON_FAIL`, `REDIS_REMOVE_ON_COMPLETE`

Queue-backed areas include mail, Teams, calendar/event delivery, webhooks, and AI/vectorization-style background processing depending on the feature path.

The monitoring queue check treats only job failures observed during the last
five minutes as a current health signal. BullMQ's retained failed-job count is
still collected as telemetry, but it is historical storage and must not keep
the queue health permanently critical. To inspect and deliberately remove only
retained failed jobs from Sapling's known queues, first build the backend and
run:

```bash
npm run queues:clear-failed --prefix backend
npm run queues:clear-failed --prefix backend -- --confirm
```

On existing installations that still use the historical root deployment, the
same targeted maintenance flow can be started interactively with
`bash ./redis-clear.sh`. Run the script as the same Unix user that owns the
`sapling-backend` PM2 process. It first shows a preview, stops only that backend
process, and restarts it after cleanup if it was running beforehand. It never
runs a global Redis `FLUSHDB` or `FLUSHALL`.

The first command is a preview. The confirmed command removes only failed jobs
from `emails`, `email-inbox-sync`, `imports`, `teams`, `webhooks`, `calendar`,
and `calendar-sync`. It does not flush Redis and does not touch waiting, active,
delayed, or completed jobs. Stop the Sapling backend during the confirmed run;
Redis itself must remain available.

Inbound mailbox polling uses queue `email-inbox-sync`. Active inbox
subscriptions are checked once per minute; each subscription controls its own
polling interval. Recurring polling is disabled when `REDIS_ENABLED=false`,
although administrators can still run the synchronous manual endpoints.

## Storage Operations

Uploaded documents are stored below:

```text
backend/storage/<entityHandle>/<uuid>
```

The database stores metadata in `DocumentItem`, including original filename, MIME type, file length, entity handle, and record reference.

Operational checks:

- Back up `backend/storage` together with the database.
- Keep storage and database snapshots aligned.
- Watch disk usage if uploads are heavily used.
- Configure reverse proxy upload limits consistently with frontend/backend limits.

## Logs

Backend logging is controlled by `LOG_*` in `backend/.env`.

Authenticated API responses include `Server-Timing` values for authentication,
handler execution, and total request duration. Performance matrices also record
their response coverage, p99 latency, one-second load-generator host CPU/RAM
samples, optional PostgreSQL connection-state samples, auth mode,
logging/cache/index switches, and DB-pool metadata. Declare the actual runtime
when using the platform wrapper, for example
`run-performance-test.ps1 -BackendMode production` on Windows or
`bash ./run-performance-test.sh --backend-mode production` on Linux; omitted
modes are reported as `unknown`.

HTTP access logging through Morgan is configured independently from
`LOG_LEVEL`:

- `LOG_REQUESTS_CONSOLE_ENABLED=true|false` controls the `dev` request log on
  stdout.
- `LOG_REQUESTS_FILE_ENABLED=true|false` controls the rotating
  `LOG_NAME_REQUESTS` access-log file.

Both default to `true` when omitted. Restart the backend after changing them.
For comparable performance tests, keep both settings identical across every
load level.

Check:

- request logs for HTTP errors and authentication issues
- server logs for backend exceptions
- queue/delivery logs for failed retries
- webhook delivery records for provider responses
- email/Teams/event delivery records for integration responses

Typical local paths:

```text
backend/log
backend/storage
```

## Health Checks

The administrator-only system monitor at `/system` includes live database and
local document-storage diagnostics. The database panel reports the PostgreSQL
version, current database size, schema, connection usage, and server start
time, while its detail area lists the nine largest application tables including
indexes. The file-storage panel scans `backend/storage`, reports the total size
and file count, and lists the nine largest top-level entity folders. The
corresponding API endpoints are `GET /api/system/database` and
`GET /api/system/document-storage`. Their panel detail buttons load the complete
size-sorted lists only when opened through `GET /api/system/database/tables`
and `GET /api/system/document-storage/entities`; closing the dialog keeps those
full lists out of the normal system-monitor refresh cycle.

The same page is an environment-aware monitoring workspace. Collection and
active checks run in the backend even when no browser has the page open.
Infrastructure samples are taken every ten seconds by default, HTTP activity is
aggregated in minute buckets, and grouped errors, checks, incidents, and safe
remediation evidence are retained according to
[`system-monitoring.md`](../features/system-monitoring.md). Check
`GET /api/system/monitoring/collector-status` and
`GET /api/system/monitoring/checks` when charts show a gap.

Set `SYSTEM_TELEMETRY_ENVIRONMENT_ID` to the same stable value on every process
of one installation and give each process a stable
`SYSTEM_TELEMETRY_PROCESS_SLOT`. Also review `SYSTEM_TELEMETRY_ENABLED`,
`SYSTEM_MONITORING_CHECKS_ENABLED`, `SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS`, and
`SYSTEM_TELEMETRY_SPOOL_MAX_MB`. A complete outage of the only host is visible
only after restart because this deployment deliberately has no external
watchdog.

The Ubuntu deployment writes `host:<domain>` as an explicit environment ID,
the domain as its display name, and `backend:0` as the process slot. This keeps
the history of installations that previously used the hostname fallback. Run
`saplingctl configure` once after upgrading an older installation so the shared
backend environment file receives these values. The
`telemetry.configuration` check must then be healthy and the environment kind
must be `production`.

After deployment or an update:

1. Backend starts without migration errors.
2. Frontend loads and can call `/api/current/person`.
3. Login works for the intended providers.
4. Swagger opens.
5. Generic list for a common entity loads.
6. A table row can open its dialog.
7. Inbox/open task counters update after a relevant change.
8. File upload/download works for one test record.
9. Optional Redis-backed deliveries can enqueue and complete.
10. Semantic search works if AI/vectorization is enabled.
11. `/api/health/live` and `/api/health/ready` return successfully.
12. `/system` shows the expected environment and recent database, application,
    and telemetry check results.

## Ubuntu Deployment And Updates

New Ubuntu systems use the interactive local installer, copied and started over SSH:

```bash
scp -r deploy operator@sapling.example.com:sapling-deploy
ssh operator@sapling.example.com
sudo bash ~/sapling-deploy/setup.sh
```

The installer may stop after the operating-system update when a reboot is required. Reboot and run the same command again; completed phases are recorded under `/var/lib/sapling-deployment/phases`.

Normal operation uses the installed management command:

```bash
sudo saplingctl update
sudo saplingctl status
sudo saplingctl doctor
sudo saplingctl backup
sudo saplingctl configure
sudo saplingctl rollback <release-directory>
```

`update` fetches the configured Git ref into a bare mirror and exports an immutable release. It installs dependencies and builds before touching the active service. A successful compressed database backup is mandatory before PM2 is stopped and migrations plus seeders run. The `current` symlink changes atomically only after those steps.

On a failed activation, the previous code release is restarted. Database migrations are not reversed automatically. Use the retained pre-deployment dump for a deliberate database restore in a maintenance window.

Persistent state lives below `/var/www/sapling/shared` by default: backend/frontend environment files, uploaded documents, logs, infrastructure data, and database backups. Never remove a release tree manually without first resolving the `current` symlink.

The root `deploy.sh` remains a legacy update path for existing systems only. New installations must not mix that script with `saplingctl` release management.

## Common Incidents

### Frontend Cannot Reach Backend

Check:

- `VITE_BACKEND_URL`
- backend process status
- browser network tab
- CORS origin via `SAPLING_FRONTEND_URL`
- reverse proxy `/api/` routing

The generated HTTPS Nginx configuration gives
`POST /api/ai/markdown/prepare` a one-hour upstream read timeout. This matches
the long-running AI routes and allows local models to finish a cold start before
returning the prepared Markdown. After updating an existing installation, run
`sudo saplingctl configure` to render and reload the current Nginx template.

### Login Fails

Check:

- local user is active
- password hash settings match existing hashes
- session cookie secure/sameSite settings match HTTP vs HTTPS
- Azure/Google callback URLs match provider app settings
- `SESSION_TRUST_PROXY` behind reverse proxies

### Migrations Fail

Check:

- database credentials
- database user privileges
- pgvector availability for vector columns
- whether a previous migration partially applied
- generated migration order

Do not manually edit production schema unless the migration path is understood and backed up.

### Seeders Skip Expected Data

Check:

- `DB_DATA_SEEDER`
- JSON path under `json-production` or `json-demonstration`
- `seed_script_item`
- whether the new data was placed in an already executed file

Prefer adding a new numbered seed file over editing a previously executed one.

### Upload Or Preview Fails

Check:

- `DocumentItem` exists
- referenced entity and record still exist
- file exists under `backend/storage`
- backend process can read the file
- MIME type or filename is previewable; PDFs, images, media, JSON, EML, and MSG
  have dedicated frontend viewers
- proxy `client_max_body_size` and frontend upload limit

### Queue Jobs Do Not Run

Check:

- Redis container/process
- `REDIS_ENABLED`
- Redis credentials
- backend logs for BullMQ connection errors
- delivery records for pending/failed status

For inbound mail, also check `emailInboxSubscription.lastError`, provider OAuth
scopes/session refresh, shared-mailbox group assignment, and `inboundEmail`
records in `manualReview` or `failed`. A successful import must also have a
`sourceDocument` whose stored MIME type is `message/rfc822`.

### Semantic Search Is Empty

Check:

- pgvector extension/database image
- active AI provider model for embeddings
- vectorization run status
- `AiVectorDocumentItem` rows for the entity
- current user's read permission on source records
- whether the target entity is included in vectorization config

### Webhooks Fail

Check:

- subscription is active
- target URL and method
- auth mode and credentials
- custom headers
- endpoint timeout
- delivery response payload and status
- HMAC signature verification on receiver side
- retry state and `nextRetryAt`

## Backup Notes

Back up these together:

- PostgreSQL database
- `backend/storage`
- production `.env` files through a secure secret-management process

Do not rely on seeders as a backup for live business records. Seeders restore reference/configuration data, not current operational state.

## Change Safety Checklist

Before applying a risky change:

- database backup exists
- storage backup exists if documents are affected
- migration has been reviewed
- seed files are newly numbered when needed
- rollback strategy is clear
- verification commands are known
- affected integrations can be retried

After applying it:

- run smoke checks
- inspect backend logs
- inspect failed delivery records
- verify user-facing flows
- record any manual intervention
