# Integrations And Deliveries

Several Sapling integrations follow a similar delivery pattern: a user or system action creates a delivery record, optional queue processing dispatches it, and status/result fields preserve what happened.

This document describes the shared mental model across mail, Teams, calendar, and webhooks.

## Common Pattern

```text
Template / Subscription / Request
  -> Delivery entity
  -> Queue job or immediate dispatch
  -> Executor/service sends to provider
  -> Delivery status and response metadata are persisted
```

Not every integration uses every piece, but the pattern is consistent enough to guide new integrations.

## Main Areas

```text
backend/src/api/mail/
backend/src/api/teams/
backend/src/api/webhook/
backend/src/calendar/
backend/src/entity/*TemplateItem.ts
backend/src/entity/*SubscriptionItem.ts
backend/src/entity/*DeliveryItem.ts
backend/src/entity/*DeliveryStatusItem.ts
backend/src/api/template/message-template.service.ts
```

Queue processors:

```text
backend/src/api/mail/mail.processor.ts       queue: emails
backend/src/api/teams/teams.processor.ts     queue: teams
backend/src/api/webhook/webhook.processor.ts queue: webhooks
backend/src/calendar/calendar.processor.ts
```

## Queue Infrastructure

Sapling uses BullMQ with optional Redis.

Important environment variables:

```text
REDIS_ENABLED
REDIS_SERVER
REDIS_PORT
REDIS_USERNAME
REDIS_PASSWORD
REDIS_ATTEMPTS
REDIS_BACKOFF_TYPE
REDIS_BACKOFF_DELAY
REDIS_REMOVE_ON_FAIL
REDIS_REMOVE_ON_COMPLETE
```

When Redis is enabled, processors handle background jobs. Some services can still support direct behavior depending on feature logic.

## Message Templates

Shared placeholder behavior is provided by:

```text
backend/src/api/template/message-template.service.ts
```

It can:

- load entity context
- resolve nested values
- replace placeholders
- format values with client locale/time zone
- strip markdown where needed

Template-driven integrations should use this service instead of hand-building placeholder replacement.

## Mail Deliveries

Main files:

```text
backend/src/api/mail/mail.service.ts
backend/src/api/mail/email-automation.service.ts
backend/src/api/mail/mail.processor.ts
backend/src/api/mail/mail.controller.ts
backend/src/api/mail/email-inbox-sync.service.ts
backend/src/api/mail/email-inbox-sync.processor.ts
backend/src/entity/EmailTemplateItem.ts
backend/src/entity/EmailSubscriptionItem.ts
backend/src/entity/EmailDeliveryItem.ts
backend/src/entity/EmailDeliveryStatusItem.ts
```

Mail supports:

- template preview
- generic create/update subscriptions
- markdown rendering
- Azure/Microsoft Graph senders
- Google senders
- attachments from document records
- delivery tracking
- optional per-rule, per-record suppression of repeated automatic deliveries
- optional creation of a related event entry

The `emails` queue passes:

```ts
{
  deliveryId: number;
}
```

The processor calls:

```ts
mailService.dispatchDelivery(deliveryId);
```

Automatic email subscriptions are evaluated after generic entity create/update
mutations. A subscription without conditions always sends when the lifecycle
trigger matches. A subscription with conditions requires every condition to
match. Configured old and new values are independent predicates: an empty old
value does not require the field to have changed, so a new-value predicate can
act as a guard on the current record state. A condition with neither an old nor
a new value remains a pure "field changed" condition. Boolean predicates treat
only `true` as yes and every other value, including `null`, as no. Delivery uses
the configured sender person, so that user must have an Azure or Google person
type and a usable provider session.

Inbound email uses a related import pattern: an `EmailInboxSubscriptionItem`
queues provider polling, each unique provider message becomes an
`InboundEmailItem`, and the complete RFC 822 source is stored as a
`DocumentItem`. Optional AI processing prepares a permission-checked mutation;
the importer automatically confirms only one action for the configured ticket,
opportunity, or office-task target. See `docs/features/inbound-email.md`.

## Teams Deliveries

Main files:

```text
backend/src/api/teams/teams.service.ts
backend/src/api/teams/teams.processor.ts
backend/src/api/teams/teams.controller.ts
backend/src/entity/TeamsTemplateItem.ts
backend/src/entity/TeamsSubscriptionItem.ts
backend/src/entity/TeamsDeliveryItem.ts
backend/src/entity/TeamsDeliveryStatusItem.ts
```

Teams uses templates/subscriptions and Microsoft Graph delivery behavior.

The `teams` queue passes:

```ts
{
  deliveryId: number;
}
```

The processor calls:

```ts
teamsService.dispatchDelivery(deliveryId);
```

## Webhook Deliveries

Main files:

```text
backend/src/api/webhook/webhook.service.ts
backend/src/api/webhook/webhook.processor.ts
backend/src/api/webhook/webhook-delivery.executor.ts
backend/src/entity/WebhookSubscriptionItem.ts
backend/src/entity/WebhookDeliveryItem.ts
backend/src/entity/WebhookDeliveryStatusItem.ts
backend/src/entity/WebhookAuthentication*Item.ts
```

Webhooks support:

- subscription types
- payload types
- HTTP methods
- authentication modes
- delivery attempts
- response metadata
- retries through BullMQ attempts/backoff

The `webhooks` queue passes:

```ts
{
  deliveryId: number;
}
```

The processor calls:

```ts
executor.execute(deliveryId, attemptsMade + 1);
```

## Calendar Deliveries

Main files:

```text
backend/src/calendar/
backend/src/calendar/azure/
backend/src/calendar/google/
backend/src/calendar/sync/
backend/src/entity/EventDeliveryItem.ts
backend/src/entity/EventDeliveryStatusItem.ts
backend/src/entity/EventAzureItem.ts
backend/src/entity/EventGoogleItem.ts
backend/src/entity/CalendarSyncSubscriptionItem.ts
```

Calendar delivery handles synchronization with external providers and recurrence-aware event behavior.

Automatic Outlook import uses the `calendar-sync` BullMQ queue and `CalendarSyncSubscriptionItem`. A scheduler job finds due active subscriptions and creates one import job per subscription, reusing the same Azure import code path as the manual calendar action.

See also:

```text
docs/features/calendar.md
```

## Status Entities

Delivery status entities provide stable handles for state transitions.

Common states usually include concepts like:

```text
queued
sent / delivered
failed
cancelled
```

Use status entities instead of ad hoc string fields so translations, filters, colors, icons, and permissions stay consistent.

## Adding A New Delivery Integration

1. Define the delivery entity.
2. Define a status entity when state is needed.
3. Define template/subscription entities if the integration is event-driven or template-driven.
4. Add migrations.
5. Register entities in `ENTITY_REGISTRY`.
6. Add seed data:
   - entity
   - entity route
   - translations
   - status/reference rows
   - permissions
7. Add service and optional executor.
8. Add a BullMQ processor and queue config if background dispatch is needed.
9. Persist provider request/response metadata for diagnostics.
10. Add tests for dispatch success, failure, and retry behavior.

## Error Handling

Delivery services should:

- persist failures on the delivery row
- store provider status code/body/headers when useful and safe
- avoid losing the original request payload
- use retry attempts for transient provider errors
- avoid retrying permanent validation errors
- log enough context to debug without exposing secrets

## Security Notes

- Store provider secrets encrypted or in secure configuration.
- Do not log OAuth tokens, API keys, or authorization headers.
- Keep delivery payloads scoped to fields needed by the external system.
- Respect entity permissions before offering UI actions that create deliveries.

## Common Mistakes

- Sending directly without creating a delivery record first.
- Not saving provider error details.
- Retrying permanent validation errors.
- Logging sensitive authentication data.
- Building placeholder rendering separately from `MessageTemplateService`.
