# GitHub Repository View

The authenticated `/api/github` endpoints proxy the configured repository using
the installation's `GITHUB_API_URL`, `GITHUB_REPO`, and `GITHUB_TOKEN`. All users
of this integration see the same configured repository; the session/bearer guard
still runs for every request. No per-user credentials are cached.

Repository metadata, releases, and issue lists have a process-local 30-second
cache. Issue-list keys are separate for open, closed, and all issues, and cached
lists include their loaded comments. Concurrent misses share one in-flight
request, including comment loading. The TTL starts when a read succeeds. Failed
reads are discarded so the next request can retry; caller mutations cannot alter
the shared cached value.

Creating an issue invalidates cached reads after the issue is created and again
after label synchronization, including label failures. An older in-flight read
may finish for its original caller but cannot refill the invalidated cache.
Changes made directly in GitHub become visible on the next read after the TTL;
multiple backend processes maintain independent caches with the same TTL.

The API DTOs and issue/comment filtering remain unchanged. This optimization
reduces repeated external reads; it does not change GitHub write permissions or
send additional requests that create issues, comments, or notifications.

Implementation: `backend/src/api/github/github.service.ts` and
`backend/src/api/github/github-read-cache.ts`.
