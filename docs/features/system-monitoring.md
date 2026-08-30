# System Monitoring And Telemetry

Sapling's administrator-only `/system` page combines current diagnostics with
persistent infrastructure, HTTP, user-presence, AI-usage, and alert history.
Collection is owned by the backend and does not depend on an open browser.

## Data Flow

The system collector records CPU, physical and process memory, event-loop lag,
network interfaces, filesystems, PostgreSQL connections and size, and local
document storage. Fast values use ten-second buckets; more expensive sources
run every minute or every fifteen minutes.

Filesystem collection is limited to local storage that represents host
capacity. Network mounts and virtual cloud drives (for example Google Drive,
OneDrive, DriveFS, WebDAV, SMB/CIFS, NFS, or rclone mounts) are classified and
excluded from both the current storage view and historical alert evaluation.
On Windows, Sapling also consults the FileSystem `PSDrive` metadata so cloud
drives that present themselves as FAT32 can still be recognized without a
hard-coded drive letter.

An early Express middleware counts application request and response bytes,
status classes, route groups, duration histograms, and the authenticated person
or API-token handle. It swaps an in-memory accumulator every ten seconds and
upserts minute buckets, so monitoring does not add one database write per
request. AI agent-run usage is normalized into input, output, and total tokens.
Session records expose a denormalized person handle and last-seen time for
presence queries.

## Privacy And Access

Every monitoring API is protected by the existing session/bearer and
administrator guards. Telemetry never stores request bodies, query values,
concrete URLs, prompts, IP addresses, cookies, authorization headers, or user
agents. Impersonated requests are attributed to the real administrator.

`online` means authenticated activity during the last five minutes. A valid
session is reported separately and can remain valid without the user being
online. API-token use is never treated as interactive presence.

## Retention

- ten-second infrastructure buckets: 48 hours
- minute buckets: 7 days
- fifteen-minute buckets: 30 days
- hourly buckets: 90 days
- AI usage and authentication events: 90 days
- resolved incidents: 90 days

An hourly maintenance service creates idempotent rollups under a PostgreSQL
advisory lock before deleting expired source buckets.

## Alerts

Seeded rules cover CPU, memory, filesystems, database connections, HTTP 5xx
rate and p95 latency, AI errors, and collector gaps. Administrators can enable
rules and adjust thresholds on the system page. A rule opens one deduplicated
incident per dimension and resolves it after three healthy evaluations. New
incidents create one Inbox notification for every active administrator and link
back to `/system?incident=<handle>`.

If warning and critical rules for the same metric and dimension are both
exceeded, only the critical incident remains open. The warning is suppressed
until the critical condition clears, avoiding duplicate incidents for one
underlying problem.

## Configuration

```text
SYSTEM_TELEMETRY_ENABLED=true
SYSTEM_TELEMETRY_INSTANCE_ID=
INSTANCE_ID=
SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS=10000
SYSTEM_TELEMETRY_SPOOL_MAX_MB=100
```

`INSTANCE_ID` is accepted as a compatibility alias; the namespaced variable
takes precedence.

The instance id defaults to hostname plus the PM2 instance number. Sapling can
show an outage as a historical sample gap after restart, but a stopped host
cannot notify from inside itself; external uptime monitoring remains necessary
for that case.
