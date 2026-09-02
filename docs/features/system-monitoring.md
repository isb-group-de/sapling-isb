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

## Environment And Process Lifecycle

Every persisted telemetry, HTTP, authentication, AI, error, check, incident,
and remediation record belongs to a `SystemTelemetryEnvironmentItem`. Configure
`SYSTEM_TELEMETRY_ENVIRONMENT_ID` explicitly and identically on all application
processes of one installation. If it is omitted, the sanitized hostname is used,
which is safe but deliberately keeps different hosts separate.

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

The collector records CPU, physical and process memory, event-loop lag, network
interfaces, filesystems, document storage, active HTTP requests, PostgreSQL
connections, probe latency, waiting locks, cumulative deadlocks/rollbacks, and
Redis queue depth, state, connection latency, and oldest waiting-job age. Fast
values use ten-second buckets; expensive sources run every minute or every
fifteen minutes.

HTTP middleware assigns request and correlation IDs before normal request
processing. It records status classes, aborted/time-out requests, bytes,
duration histograms, stable controller-route operations, route groups, and
privacy-safe person/API-token attribution in aggregated minute buckets. It never
consumes request bodies. Browser telemetry adds boot time, LCP, INP, and CLS.

Backend exceptions, process warnings, uncaught-exception observations, browser
errors, failed/stalled queue jobs, and telemetry failures are normalized into a
release-aware fingerprint. Repeated occurrences update one error group and keep
bounded occurrence evidence with request/correlation IDs. Messages and stacks
are truncated and redact email addresses, long tokens, numeric identifiers, and
filesystem paths before persistence. Error capture never changes the original
failure or crash semantics.

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

Hourly maintenance creates idempotent rollups under a PostgreSQL advisory lock
before bounded deletion. The original environment and stable HTTP operation are
preserved through every rollup resolution.

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
