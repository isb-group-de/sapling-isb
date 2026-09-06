# System Monitoring And Telemetry

Sapling's administrator-only `/system` workspace combines current diagnostics,
persistent telemetry, error correlation, active checks, incidents, and the audit
trail of safe remediation actions. Collection is owned by the backend and does
not depend on an open browser.

## Monitoring Workspace

The page has five compact working areas instead of separate full-width sections:

- **Overview** shows health, request/SLO, host, user, service, incident, and trend
  summaries.
- **Incidents** combines alert incidents, grouped errors, check history,
  remediation history, rule configuration, and incident drill-down.
- **Services** shows the latest database, application, telemetry, queue, storage,
  HTTP, frontend, and AI check result together with detailed diagnostics.
- **Performance** contains host/runtime diagnostics, request percentiles and
  grouped request analysis.
- **Usage** combines interactive-user and AI-provider usage.

The selected time range, environment, active area, and incident deep link are
shareable URL state. The first range is one hour. Summary data loads first and
detail requests run with a concurrency limit of two.

The router includes only the lightweight system page shell. It displays the
shared system skeleton immediately after the normal authentication guard and
loads the monitoring components (including ECharts) after mounting. These module
downloads must not block route navigation or the authenticated layout's Suspense.
Translation loading reuses the same skeleton; module-load failures show a retry
action instead of leaving the previous page visible.

The incident drill-down uses the shared large Sapling detail-dialog pattern. Its
hero contrasts the observed value with the comparator and trigger threshold in
the metric's native unit. The body separates the incident timeline from the
evaluation context. Empty dimensions are presented as the entire system, sample
count is explained as the number of measurements in the evaluation window, and
the internal metric key remains visible as explicitly technical information.

## Environment And Process Lifecycle

Every persisted telemetry, HTTP, authentication, AI, error, check, incident,
and remediation record belongs to a `SystemTelemetryEnvironmentItem`. Configure
`SYSTEM_TELEMETRY_ENVIRONMENT_ID` explicitly and identically on all application
processes of one installation. If it is omitted, the sanitized hostname is used,
which is safe but deliberately keeps different hosts separate.

The environment name and kind are refreshed on every collector start while the
stable handle and its history remain unchanged. Production processes expose a
warning check when they still use the hostname fallback. The Ubuntu deployment
uses `host:<domain>` explicitly so upgrades retain the existing single-host
history.

A process slot is stable across restarts; a boot ID is not. The effective
instance handle is `<process-slot>:<boot-id>`. Startup retires a still-active
instance in the same slot as an unclean restart, while graceful shutdown marks
the current instance stopped. Alert evaluation only considers active instances,
so retired processes cannot create permanent collector-gap incidents.

The first environment-aware rollout assigned pre-migration records to reserved
`legacy-imported` and `legacy:*` environments rather than silently mixing them
with current production data. Those early trial observations were deliberately
removed by a subsequent one-time migration because they predated a meaningful
monitoring baseline. Current and future host/configured environments are not
affected by that cleanup.

## Metrics And Errors

The collector records CPU, physical and process memory, event-loop lag, garbage
collection counts and pauses, network
interfaces, filesystems, document storage, active HTTP requests, PostgreSQL
connections, probe latency, waiting locks, cumulative deadlocks/rollbacks, and
Redis queue depth, state, connection latency, and oldest waiting-job age. Fast
values use ten-second buckets; expensive sources run every minute or every
fifteen minutes.

HTTP middleware assigns request and correlation IDs before normal request
processing. It records status classes, aborted/time-out requests, bytes,
duration histograms, stable controller-route operations, route groups, and
privacy-safe person/API-token attribution in aggregated minute buckets. Standard
requests and long-lived SSE/NDJSON streams are stored separately; expected stream
disconnects do not affect the standard API SLO. Registered generic resources are
available as a bounded analysis dimension. The middleware never consumes request
bodies. Browser telemetry adds final boot, LCP, INP, and CLS values in batches of
at most 20 measurements.

Backend exceptions, process warnings, uncaught-exception observations, browser
errors, failed/stalled queue jobs, and telemetry failures are normalized into a
release-aware fingerprint. Repeated occurrences update one error group and keep
bounded occurrence evidence with request/correlation IDs. Messages and stacks
are truncated and redact email addresses, long tokens, numeric identifiers, and
filesystem paths before persistence. Error capture never changes the original
failure or crash semantics.

Error-group and occurrence persistence is one atomic statement. Data before the
application of `Migration20260902170000` is an explicit repair boundary: old
groups may have no occurrence evidence because an earlier occurrence insert was
malformed, and that missing evidence cannot be reconstructed.

## Active Checks And SLOs

Checks run once per minute under an environment-specific PostgreSQL advisory
lock. They cover database connectivity/capacity, telemetry freshness, queue
flow, filesystem capacity, recent HTTP reliability, frontend experience, and AI
reliability. Every five minutes a hidden canary record is inserted, read, and
deleted inside one transaction to verify the application write path without
touching business records.

Collector-gap warnings consider only active, enabled collector instances;
stopped and retired process history remains inspectable but cannot create a
current gap banner. Queue health uses the oldest waiting job plus job failures
observed during the last five minutes. The retained BullMQ failed-job count is
historical storage and is not itself a current-health failure.

AI reliability counts only terminal `completed` and `failed` calls and treats only
`failed` as an error. Running, interrupted, and cancelled work remains visible but
does not create a transient reliability failure.

Frontend experience uses the worst browser value observed during the last 15
minutes. LCP is the required freshness signal; without a recent LCP the check is
`unknown`, not a synthetic healthy zero. INP and CLS are displayed as unavailable
when absent and can only worsen the result when they have actually been observed.
An unknown check is neutral for aggregate health and remediation verification.

The overview currently evaluates an API-success SLO of 99.9 percent and an API
p95 target of 1,000 ms. Threshold alert rules still support minimum samples,
deduplicated incidents, severity escalation, and three healthy evaluations
before resolution. Rule metadata also carries evaluation configuration and a
shadow-mode flag so new baseline/anomaly policies can be observed before being
made active.

## Safe Remediation

Remediation is deny-by-default. The only allowlisted actions are:

- `telemetry.recover`: request an immediate collector sample, then verify the
  telemetry check three consecutive times;
- `checks.retry`: rerun the non-destructive checks and require three consecutive
  healthy evaluations.

Actions can be administrator-approved from an incident or invoked automatically
by a non-shadow alert rule configured for automatic remediation. Each execution
has an idempotency key, actor/mode, state, attempt, timestamps, and evidence.
There is no shell or arbitrary job execution path. The seeded collector-gap rule
is the only automatic action; queue backlog rules only suggest intervention.

## Privacy And Access

Monitoring APIs use the existing session/bearer and administrator guards. The
small browser-ingest endpoints accept only strict allowlisted fields and metric
names, have a process-local rate limit, and remain subject to the application's
unsafe-origin protection. Telemetry never stores request bodies, query values,
concrete URLs, prompts, IP addresses, cookies, authorization headers, or user
agents. Impersonated requests are attributed to the real administrator.

The telemetry entities are available to administrators as generic tables in the
**System > Monitoring & telemetry** navigation group. They include environments,
error groups and occurrences, check runs, remediation executions, instances,
metric buckets, usage events, alerts, and the normally empty canary table.
Collectors and dedicated monitoring services remain the only writers. The
permission seeder grants the new tables to administrators only, and the generic
API enforces the administrator boundary independently of configurable entity
permissions. All other roles remain denied for both reading and navigation
visibility.

`online` means authenticated activity during the last five minutes. A valid
session is reported separately. API-token use is never interactive presence.

## Retention

- ten-second infrastructure buckets: 48 hours
- minute buckets: 7 days
- fifteen-minute buckets: 30 days
- hourly buckets: 90 days
- individual error occurrences and check runs: 14 days
- error groups, remediation executions, AI usage, authentication events, and
  resolved incidents: 90 days

Minute maintenance creates idempotent rollups under a PostgreSQL advisory lock
before bounded deletion. The original environment and stable HTTP operation are
preserved together with request kind and resource through every rollup resolution.
Automatic chart resolution is ten seconds through two hours, one minute through
48 hours, fifteen minutes through 30 days, and one hour afterward. Metrics whose
native collection cadence is slower use the finest available native resolution.

### Rollup Integrity And Historical Repair

Maintenance selects whole target buckets for its two-hour refresh window and
aggregates every retained source row in those buckets. It excludes open buckets
and buckets crossing the source-retention boundary. Repeated runs do not rewrite
unchanged aggregates. Native minute and fifteen-minute measurements are retained
at their original resolution.

The September 6, 2026 investigation found that the previous moving refresh cutoff
could overwrite a complete bucket with only its remaining source rows. This
affected infrastructure minute/quarter-hour/hour values and HTTP quarter-hour/hour
values. Updating the collector code does not automatically repair all older data.

After building the backend, preview a bounded repair from the repository root:

```powershell
npm run telemetry:repair --prefix backend -- --environment host:sapling.isb-solutions.de --from 2026-09-03T13:17:00+02:00 --to 2026-09-06T12:00:00+02:00
```

The command requires an existing environment and explicit ISO timestamps with a
time zone, accepts at most 90 days, and uses a read-only transaction by default.
It starts no collectors, migrations, seeders, or application jobs. It shares the
maintenance advisory lock and fails if maintenance is busy. Add `--apply` to the
same command to explicitly apply the repair in one transaction; any failure rolls
it back. No repair is run automatically on deployment.

The report lists `reconstructible`, `changes`, `unreconstructible`, and `written`
per source/target, plus unsupported metrics. Repairs read original native samples
directly, including for hourly targets, rather than trusting damaged intermediate
rollups. System buckets require one original sample in every expected native
time slot, so gaps, partial process lifetimes, and slower configured cadences are
conservatively skipped. Unknown metric keys and sparse browser samples are also
skipped. HTTP repairs use retained original minute buckets; absence of an HTTP
bucket means no recorded requests, not proof that the service was available.
All repairs exclude open buckets, partial requested buckets, and expired source
ranges. Missing original evidence cannot be reconstructed, even if an old
aggregate still exists. Entirely missing sources and targets cannot be counted.

The native-key allowlist in `backend/src/maintenance/telemetry-repair.ts` must be
reviewed when collector metrics or their native cadence change. The command uses
the current database clock and retention windows, so old imported snapshots may
have fewer safely repairable buckets than they had when the backup was taken.

### September 2026 Performance Findings

For the server environment after the September 3 restart at 13:16:57 Europe/Berlin
(release 1.150.1440), the imported data through September 6 around 12:15 contained
40,673 standard requests averaging 54.9 ms, without HTTP 500-class errors. The
histogram placed p95 at or below 250 ms and p99 at or below 500 ms. Streams were
evaluated separately. Translation reads contributed 12,450 requests; this includes
pagination and does not establish how many were redundant.

Calendar recurrence detachment remains a separate performance follow-up: ten
calls averaged 24.6 seconds and reached 47 seconds. The calendar queue reached
903 waiting jobs and an oldest waiting age of approximately twelve minutes.
Those observations warrant profiling the repeated generic mutation lifecycle
and provider deliveries; they do not establish that queued delivery time caused
the HTTP latency. This change does not alter calendar behavior. Low activity,
the environment's `development` classification, and damaged historical rollups
limit broader load or before/after conclusions.

## Configuration

```text
SYSTEM_TELEMETRY_ENABLED=true
SYSTEM_TELEMETRY_ENVIRONMENT_ID=production-eu-1
SYSTEM_TELEMETRY_ENVIRONMENT_NAME=Production EU 1
SYSTEM_TELEMETRY_PROCESS_SLOT=backend:0
SYSTEM_MONITORING_CHECKS_ENABLED=true
SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS=10000
SYSTEM_TELEMETRY_SPOOL_MAX_MB=100
```

`SYSTEM_TELEMETRY_INSTANCE_ID` and then `INSTANCE_ID` remain compatibility
fallbacks for the process slot. New deployments should use
`SYSTEM_TELEMETRY_PROCESS_SLOT`.

## Known Availability Boundary

Sapling intentionally has no external watchdog in this implementation. A full
outage of the only host cannot notify while that host is down. Boot lifecycle
and sample gaps reconstruct the outage after restart, but real-time detection of
that one condition requires a separately operated uptime monitor in the future.
