# Reference Automations

Sapling provides a shared event and rule foundation for Inbox, Teams, webhook,
and field automations. Rules can react to a record itself or follow an explicit
relation path to a different target record. No business entity or status is
hard-coded into the engine.

## Rule configuration

Inbox, Teams, and webhook subscriptions keep their existing delivery settings
and add these trigger settings:

- `sourceEntity`: entity whose lifecycle event starts the rule
- `entity`: target entity used for the message, recipient, or webhook payload
- `type`: insert, update, delete, reference-added, or reference-removed event
- `referencePath`: ordered forward or inverse ORM/generic-reference steps
- `conditions`: AND conditions grouped into OR alternatives
- `priority`: deterministic display and processing order

`FieldAutomationItem` is deliberately separate. It uses `sourceEntity`,
`targetEntity`, `operation`, `referencePath`, and `conditions`, then applies the
fixed values in `assignments` through normal generic update permissions. New
Inbox, Teams, webhook, and field rules default to inactive.

Conditions select either the source or target context and support changed,
equals, changes-to, changes-from, and full old-to-new transitions. Templates
receive the ordinary target fields plus `target`, `source`, `oldSource`,
`newSource`, `currentUser`, and `event`. Webhooks expose the event values in an
`automation` property.

## References

Forward and inverse steps support to-one and collection ORM relations.
Properties decorated with `@SaplingGenericReference` support entity/handle
references in either direction. Documents, phone calls, record information,
change logs, external links, Inbox notifications, and email deliveries expose
this metadata. A path is validated against entity templates before a rule is
saved and again when it is evaluated.

For an incoming archived message represented as a Document, configure the
Document as source, follow its generic `reference` to the desired target, and
add `type = email` as a source condition. The target status or notification
recipient remains entirely configurable.

## Processing and safety

Generic create, update, delete, bulk, inline collection, and relation mutations
write durable `AutomationEventItem` rows in the business-data transaction.
Direct document uploads and outbound email persistence do the same. Redis
installations wake the automation worker through BullMQ; installations without
Redis process the same database-backed events in-process and scan for pending
work after startup. Interrupted events are reclaimed, and technical failures
use persisted retry times with exponential backoff.

`AutomationExecutionItem` provides idempotency and the per-rule result. Field
actions use the original actor's current permissions. Higher-priority field
rules own conflicting fields; a lower-priority conflicting rule is skipped as
a unit. Follow-up mutations keep the chain id, a rule can run only once for the
same target in one chain, and processing stops at 32 levels. Inbox, Teams, and
webhook deliveries also store automation deduplication keys, so a retry cannot
create or send the same action twice.

Existing subscriptions are backfilled to use their previous entity as source.
Older seed installations where `sourceEntity` is still empty continue through
the legacy direct-event path, which avoids duplicate delivery.
