# Reproducible performance comparison

## Historical baseline

Run `node backend/maintenance/performance-baseline.cjs` from the repository root.
It connects using the backend environment, opens a read-only transaction, and writes
`performance-baseline-2026-09-07.json`. Credentials, SQL parameters and record contents
are not written to the report. The query uses only one-minute buckets to avoid counting
rollups more than once.

The selected day is 7 September 2026, Europe/Berlin, environment
`host:sapling.isb-solutions.de`. The 12:55–13:15 update window is reported separately.
The recorded baseline outside that window contains 62,380 standard requests, mean
53.95 ms. Translation traffic comprised 15,747 requests and 473,281,190 response bytes.
These bytes do not establish compressed network volume. The eleven recurrence detach
calls averaged 18,268.5 ms, maximum 47,177 ms, and occurred before the update.

The restored translation catalogue contains 5,947 keys in 224 namespaces per language.
Loading that entire catalogue requires 236 legacy requests at page size 100, versus
three bundles with at most 100 namespaces each: 98.7% fewer requests for this defined
workload. This calculation does not claim a measured page-level LCP improvement.

`node backend/maintenance/verify-translation-bundles.cjs` checks the compiled bundle
service in a read-only transaction. The supplied German catalogue was verified:
all 5,947 keys matched, three bundles contained 261,853 JSON bytes in total. The
isolated verification took 207 ms; it is not an HTTP/load comparison. During the
final read-only verification, the local database already contained the new migration
and seeds (recorded at 11:17 Europe/Berlin). Its catalogue had consequently grown to
6,103 keys in 227 namespaces; those also matched completely in three bundles, versus
239 paginated requests. Preserve the earlier snapshot for controlled comparisons.

## Implemented measurements and optimizations

- `/api/translation/bundle` projects compact namespace/key/value data and returns an
  ETag. Browser revalidation can receive 304. Existing frontend batching, in-flight
  sharing, language switching and failed-load retry behavior are retained.
- The server revalidates against current committed rows on each request. This deliberately
  avoids a stale server data cache: generic changes, deletions, native seed writes and
  other backend instances become visible on the next revalidation. It provides stronger
  freshness than the proposed 60-second cross-instance fallback, at the cost of one
  small projected database query per bundle revalidation.
- Dashboard creation/template metadata and template catalogues load when their dialogs
  are opened. Hidden dashboard/table dialogs are not mounted. Existing lazy Songbird
  catalogues and cached entity templates remain in use.
- Calendar batches share field metadata across record mutations. Per-record permissions,
  conflicts, scripts and other lifecycle hooks still run. The existing transaction and
  deferred post-commit task scheduling remain intact.
- `Server-Timing` adds bounded recurrence, permissions, database, mutation, projection,
  preparation and provider phases where applicable, plus a query count. Nested phases
  overlap; do not add them to infer total HTTP time. SQL text and parameters are absent.
- Calendar delivery records separately expose initial queue wait and accumulated provider
  duration for an attempt. Queue depth does not establish the cause of slow HTTP work.
- Markdown revision separates preparation, model time and postprocessing and supports the optional
  `isDefaultMarkdown` model flag. Explicit provider/model selections take precedence.
  No provider/model default was changed in the supplied database.
- Known expired Azure tokens refresh before Graph calls; opaque tokens still use the
  provider's authentication response. Webhook 4xx errors except 408/429 terminate BullMQ
  retries; transient failures retain queue backoff. Email recipient lists are split,
  normalized, deduplicated and validated before enqueueing.

## Controlled acceptance run

1. Use two isolated checkouts/builds and the same restored database snapshot, user role,
   browser viewport, hardware and queue configuration. Keep external sends disabled in
   the benchmark environment. Never benchmark mutations against the supplied reference DB.
2. Build both frontends (`npm run build --prefix frontend`). Serve the build with the same
   origin/backend configuration. Record build commit, assets and server mode. Local
   `localhost:5173` is the Vite development environment; historical `/src/*.vue` failures
   suggest development serving but do not prove the historical deployment configuration.
   The current production build was successfully generated with Vite 8.2.2. The
   repository's nginx deployment template serves `frontend/dist`. The frontend
   package's direct `start:prod` script still starts Vite; the actual launch path
   must therefore be recorded during the controlled comparison. The build reports
   existing chunks above 500 kB, including the lazily loaded system view.
3. For start page and ticket page, run at least 20 cold navigations in each build. Use the
   same authenticated role and visible data, clear the same caches, wait for the same
   visible content and record translation requests, transfer bytes and LCP. Repeat warm
   navigation separately. Target: at least 80% fewer translation requests and 30% lower
   LCP, with no new functional errors.
4. In an isolated database, create a finite recurrence fixture and detach 1, 10 and 50
   occurrences. Restore the fixture before every run. Record HTTP duration and
   `Server-Timing`, followed separately by queue wait and provider duration. Exercise
   stale-version conflicts, duplicate occurrences, rollback and Europe/Berlin DST
   boundaries. Target: 50% improvement in slow cases that reproduce on the baseline.
5. Compare normal API p95 under identical concurrent load. Compare Markdown prompts/models
   with identical evaluation case checksums, manifests and fixture responses before
   selecting a different default.

Historical LCP samples are sparse and production usage changes around the deployment.
No 30% LCP or 50% calendar acceleration is claimed without the controlled run. If an
old 18–47 second calendar delay does not reproduce, record that result and retain the
phase evidence instead of attributing an unmeasured speedup to this change.
