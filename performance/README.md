# Sapling API performance test

This suite runs the same realistic Sapling workflow with exactly:

```text
1, 5, 10, 20, 50, 100 concurrent users
```

Each virtual user completes a fixed number of iterations (10 by default). That makes runs
comparable between commits and environments. This is an API load test, not a
unit test: Jest and Vitest are deliberately not involved.

## Workflow

One iteration performs the following user journey:

1. Load the current person, UI metadata, and permissions.
2. Load the Ticket template and a relation-rich Ticket page.
3. Open one Ticket, its timeline, and its change log.
4. Optionally exercise the Ticket update endpoint.
5. Load Person metadata/list/detail.
6. Load Company metadata/list/detail.
7. Load metadata and lists for Sales Opportunities and Events.
8. Run a permission-filtered global search.

Every step has its own latency metric. The aggregate report therefore shows not
only that the application became slower, but also which endpoint deteriorated.

## Prerequisites

- Run this against a test or staging database, never an unapproved production
  system.
- Start Sapling's backend and its required PostgreSQL/Redis infrastructure.
- Create a bearer API token for a person with access to the workflow entities.
- Use either a local `k6` installation or Docker.

The Docker runner pins `grafana/k6:0.57.0` so its execution engine is
repeatable. Override it with `SAPLING_K6_IMAGE` only intentionally.

## Run all six load levels

The simplest entry point from the repository root is:

```powershell
.\run-performance-test.ps1 -BackendMode production
```

On Ubuntu, use the equivalent Bash wrapper. It validates the same token file,
passes the same settings to the shared Node/k6 runner, and therefore creates
the identical report formats:

```bash
bash ./run-performance-test.sh --backend-mode production
```

The Bash options use kebab-case, for example:

```bash
bash ./run-performance-test.sh \
  --engine docker \
  --base-url http://localhost:3000/api \
  --token-file performance-tokens.json \
  --users 1,5,10,20,50,100 \
  --iterations-per-user 10
```

For `--engine docker`, the Ubuntu user must be allowed to run Docker. With
`--engine native`, install k6 on the host instead. Node.js and npm are required
in both cases because the matrix and self-contained HTML report are assembled
by the shared runner. On Linux, the Docker container automatically runs with
the UID and GID of the invoking user so it can write the bind-mounted result
directory without creating root-owned report files.

Use `development` instead when the backend deliberately runs through the
development command. If the mode is omitted, the report records `unknown`
rather than guessing from the process that happens to be listening on the API
port.

Add the test-system bearer tokens to `performance-tokens.json`:

```json
["token-1", "token-2", "token-3", "token-4", "token-5"]
```

The PowerShell runner reads this file and passes the array to k6. Virtual users
receive the tokens in array order and wrap to the first token after the last
one. Each virtual user keeps its assigned identity for the complete workflow;
tokens are not changed between individual requests. Use `-TokenFile` to select
another JSON file.

PowerShell with native k6:

```powershell
$env:SAPLING_TOKEN = '<one-time-copied-api-token>'
$env:SAPLING_BASE_URL = 'http://localhost:3000/api'
npm run test:performance
```

PowerShell with Docker:

```powershell
$env:SAPLING_TOKEN = '<one-time-copied-api-token>'
$env:SAPLING_BASE_URL = 'http://localhost:3000/api'
npm run test:performance -- --engine docker
```

The Docker runner automatically maps a localhost backend to
`host.docker.internal`.

For a quick connectivity check:

```powershell
npm run test:performance:smoke
```

Use a JSON token array when separate Sapling identities should be distributed
round-robin across the virtual users:

```powershell
$env:SAPLING_TOKENS_JSON = '["token-1","token-2","token-3"]'
```

Tokens are intentionally accepted only through environment variables. They are
never written to the reports.

Bearer identities can be shared or distributed one per virtual user through
`SAPLING_TOKENS_JSON`. To exercise the browser-session path instead, provide
complete `Cookie` header values through `SAPLING_SESSION_COOKIES_JSON` and set
`SAPLING_AUTH_MODE=session`. Cookie/token contents are never persisted; reports
contain only the mode and credential count.

Every matrix performs one unreported warm-up workflow before the measured load
levels. Set `SAPLING_WARMUP=false` only for deliberate cold-start tests.
Production comparisons should run the built backend (`npm run build:backend`
followed by `npm run start:prod --prefix backend`) and set
`SAPLING_BACKEND_MODE=production`.

## Configuration

| Variable                       | Default                      | Purpose                                                             |
| ------------------------------ | ---------------------------- | ------------------------------------------------------------------- |
| `SAPLING_BASE_URL`             | `http://localhost:3000/api`  | Backend API root                                                    |
| `SAPLING_USERS`                | `1,10,...,100` in the runner | Override the user matrix                                            |
| `SAPLING_ITERATIONS_PER_USER`  | `10`                         | Complete workflows per virtual user                                 |
| `SAPLING_AUTH_MODE`            | inferred                     | `bearer` or `session`                                               |
| `SAPLING_BACKEND_MODE`         | `unknown`                    | Declared backend runtime: `production`, `development`, or `unknown` |
| `SAPLING_SESSION_COOKIES_JSON` | none                         | Session `Cookie` headers distributed round-robin                    |
| `SAPLING_WARMUP`               | `true`                       | Run one warm-up workflow before the matrix                          |
| `SAPLING_THINK_TIME_MS`        | `250`                        | Fixed pause between UI-style navigation groups                      |
| `SAPLING_P95_LIMIT_MS`         | `2000`                       | Global HTTP p95 threshold                                           |
| `SAPLING_MAX_ERROR_RATE`       | `0.01`                       | Maximum HTTP/check/workflow error rate                              |
| `SAPLING_MAX_DURATION`         | `10m`                        | Safety timeout for each load level                                  |
| `SAPLING_EXTRA_ENTITIES`       | `salesOpportunity,event`     | Additional template/list visits; set to an empty string to disable  |
| `SAPLING_TICKET_FILTER`        | none                         | JSON filter limiting tickets used by the test                       |
| `SAPLING_WRITE_MODE`           | `none`                       | `none`, `same-value`, or `round-trip`                               |
| `SAPLING_RESULTS_DIRECTORY`    | timestamped folder           | Explicit report directory                                           |
| `SAPLING_K6_BINARY`            | `k6`                         | Native k6 executable                                                |
| `SAPLING_K6_IMAGE`             | `grafana/k6:0.57.0`          | Docker image                                                        |
| `SAPLING_DATABASE_TELEMETRY`   | local API only               | Force-enable or disable PostgreSQL sampling                         |

CLI arguments can override the most common runner settings:

```powershell
npm run test:performance -- --engine native --users 1,10,50 --iterations 5
```

## Write modes

`none` is read-only and is the safe default.

`same-value` sends a real `PATCH /api/generic/ticket` with the title already on
the selected Ticket. It exercises authentication, permissions, payload
validation, scripts, concurrency handling, and the mutation route, but the ORM
may avoid a physical SQL update.

`round-trip` changes the title and immediately restores it. Use this only on a
disposable test database with dedicated performance-test Tickets. It can create
change-log records and trigger configured update side effects even though the
title is restored. An interrupted run or a failed restore can leave the
temporary `[perf ...]` suffix behind, which is another reason to use dedicated
records only.

For a round-trip test, create at least as many dedicated Tickets as the maximum
virtual-user count and restrict selection to them:

```powershell
$env:SAPLING_WRITE_MODE = 'round-trip'
$env:SAPLING_TICKET_FILTER = '{"title":{"$ilike":"PERF-%"}}'
npm run test:performance
```

The optimistic `updatedAt` token is sent when present. Conflicts are counted as
failures rather than hidden; this makes an undersized or concurrently edited
test-data set visible.

## Results

Each run creates a timestamped directory under `performance/results/`:

- `report.html`: self-contained presentation website with charts, bottleneck
  ranking, endpoint heatmap, and the complete matrix.
- `matrix.md`: human-readable comparison across all user counts.
- `matrix.csv`: the same matrix for Excel or other analysis.
- `matrix.json`: full machine-readable output for CI/regression checks.
- `steps.csv`: request count, p90/p95/p99/max HTTP latency, `Server-Timing`
  coverage, authentication/handler/server latency, and categorized request
  failures per API step and load level.
- `host-telemetry.csv`: one-second host CPU and RAM samples for every measured
  load level.
- `database-telemetry.csv`: one-second PostgreSQL connection-state samples when
  the runner can connect with the local backend database configuration.
- `summary-NNN.json`: raw normalized summary for one user count.

Open `report.html` directly in a browser; it needs neither Sapling nor a local
web server. The page also accepts another `matrix.json` through its file picker.

Create the website for an older matrix file:

```powershell
npm run performance:report -- .\performance\results\<run>\matrix.json
```

Start optimization work with `steps.csv`: compare the slope of each step's p95
from 1 to 100 users. The request count makes missing or under-exercised steps
visible, while p99 exposes tail latency that p95 can hide. A strongly growing
list endpoint often points to query, relation-loading, permission-filter, or
missing-index work. Slow mutation steps can point to synchronous scripts or
follow-up work that may be moved behind a queue, provided the business
transaction does not require it to finish before the response.

Use the `Server-Timing` coverage column before interpreting the phase values. A
coverage near 100% means each measured response supplied `auth`, `handler`, and
`total`. Compare HTTP p95 with server-total p95: a large stable gap suggests
client/network/proxy overhead, while a growing handler value keeps the search
inside the application and its downstream calls. A growing auth value instead
points to principal/session/token resolution.

New reports classify every non-2xx response per workflow step as transport
(no HTTP response/status 0), HTTP 4xx, HTTP 5xx, or other. The report website,
`matrix.md`, `matrix.csv`, and `steps.csv` include these counts plus the
observed status and k6 error-code range. The k6 console also writes one compact
diagnostic line per failed request without URL, token, cookie, or response
body. This separates backend responses from host/Docker/network interruptions
without exposing request credentials.

Host CPU/RAM describe the complete load-generator machine, not only the Sapling
process. With a local backend this is also its host; with a remote base URL it
is not backend telemetry. The database samples describe connections visible in
`pg_stat_activity`; they do not measure the ORM pool's internal wait queue.
Active connections approaching `DB_POOL_MAX`, growing database waits, and
rising handler latency together are a useful signal for pool/query
investigation, but not proof by themselves.

Database sampling uses `backend/.env` automatically only when the tested API URL
is local. For an intentional remote measurement, set
`SAPLING_DATABASE_TELEMETRY=true` and supply the matching `DB_*` variables in
the runner process; this prevents accidentally correlating a remote API with an
unrelated local database. If the `pg` package, credentials, privileges, or
database connection are unavailable, the load test continues and the report
marks database telemetry as unavailable. Database credentials are used only in
memory and never written to the results.

Correlate a suspicious step with backend request logs, PostgreSQL query
statistics/`EXPLAIN`, CPU/memory, and Redis queue depth. This suite locates the
pressure point; it does not by itself prove whether the cause is SQL, CPU,
network, locking, or synchronous integration work.

`matrix.json` also records the declared backend mode, sampled host CPU/RAM, DB
pool settings, request-logging switches, principal-cache/search-index settings,
authentication mode, and credential count. API responses expose
`Server-Timing` entries for authentication, handler, and total request time to
support endpoint-level correlation.
