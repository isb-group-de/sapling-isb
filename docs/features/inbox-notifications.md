# Inbox And Open Task Notifications

Sapling's inbox is a data-driven notification system. It creates persistent inbox notifications from entity events and template/subscription configuration, then pushes open-task refresh events to connected users.

Inbox subscriptions also support the shared conditional reference automation
contract described in [Reference Automations](reference-automations.md). This
allows a source such as a Document to notify recipients on its referenced
record without entity-specific code.

## Main Files

```text
backend/src/entity/InboxTemplateItem.ts
backend/src/entity/InboxSubscriptionItem.ts
backend/src/entity/InboxNotificationItem.ts
backend/src/api/inbox/inbox.service.ts
backend/src/api/inbox/inbox.module.ts
backend/src/api/current/open-task-events.service.ts
backend/src/api/current/current.service.ts
backend/src/api/current/current.controller.ts
frontend/src/components/account/SaplingInbox.vue
frontend/src/components/account/inbox/
frontend/src/components/system/header/SaplingHeaderInboxPreview.vue
frontend/src/composables/account/useSaplingInbox.ts
frontend/src/composables/system/useOpenTaskCountEvents.ts
frontend/src/utils/inboxRoute.util.ts
```

Seed files:

```text
backend/src/database/seeder/json-production/inboxTemplate/
backend/src/database/seeder/json-production/inboxSubscription/
backend/src/database/seeder/json-demonstration/inboxTemplate/
backend/src/database/seeder/json-demonstration/inboxSubscription/
```

## Data Model

### InboxTemplateItem

Defines message content for one entity.

Important fields:

| Field           | Meaning                                |
| --------------- | -------------------------------------- |
| `name`          | Human-readable template name           |
| `titleTemplate` | Placeholder-enabled notification title |
| `bodyMarkdown`  | Placeholder-enabled markdown body      |
| `isDefault`     | Marks default template candidates      |
| `isActive`      | Allows disabling without deleting      |
| `entity`        | Entity the template belongs to         |

### InboxSubscriptionItem

Defines when and for whom notifications are created.

Important fields:

| Field            | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `description`    | Human-readable subscription name                             |
| `recipientField` | Context path that resolves recipient person(s)               |
| `isActive`       | Enables/disables the subscription                            |
| `notifyActor`    | Also notify the person who triggered the event (default off) |
| `entity`         | Entity being watched                                         |
| `type`           | Event type, e.g. `afterInsert`, `afterUpdate`, `afterDelete` |
| `template`       | Template used for generated notifications                    |

`template` depends on `entity`, so the frontend filters template choices by selected entity.

### InboxNotificationItem

Persistent notification instance.

Important fields:

| Field               | Meaning                              |
| ------------------- | ------------------------------------ |
| `entity`            | Referenced entity type               |
| `subscription`      | Subscription that created it         |
| `template`          | Template used at creation time       |
| `recipientPerson`   | Person who receives the notification |
| `createdBy`         | User who triggered the event         |
| `referenceHandle`   | Record handle of the source entity   |
| `title`             | Rendered title                       |
| `bodyMarkdown`      | Rendered markdown body               |
| `bodyText`          | Plain-text body for previews/search  |
| `requestPayload`    | Diagnostic creation payload          |
| `isRead` / `readAt` | Read state                           |

`referenceHandle` uses `@SaplingGenericReference` together with `entity`, so the UI can navigate back to the referenced record.

Inbox notifications support deletion through the normal generic permission
flow. The `inboxNotification` entity enables `canDelete`; consequently,
`PermissionSeeder` grants and synchronizes `allowDelete` for the administrator
role by default.

Inbox notifications are dependent delivery records. Deleting either their
recipient or their creating Person therefore deletes the notification through
database-level cascades; historical notifications must not prevent a Person
from being removed.

## Notification Creation Flow

`InboxService.querySubscription(...)` is the main entry point.

Flow:

1. Load active `InboxSubscriptionItem` with entity, type, and template.
2. Validate entity and template.
3. Normalize payload to one or more source items.
4. For each item, load entity context through `MessageTemplateService`.
5. Resolve recipients from `recipientField`.
6. Render `titleTemplate` and `bodyMarkdown`.
7. Strip markdown into `bodyText`.
8. Create `InboxNotificationItem` rows.
9. Flush changes.
10. Notify affected users through `OpenTaskEventsService`.

For delete subscriptions, the payload itself is used as context because the source record may no longer exist.

## Placeholder Context

Inbox templates use the same placeholder engine as message templates.

The context contains:

```text
currentUser
source record fields
loaded relation fields
```

Examples:

```text
{{ title }}
{{ status.description }}
{{ assigneePerson.firstName }}
{{ expectedCompletionDate }}
{{ currentUser.firstName }}
```

The relation expressions passed to `querySubscription` control which nested values are available.

## Recipient Resolution

`recipientField` is a path into the template context.

It may resolve to:

- a numeric person handle
- a string numeric handle
- an object with `handle`
- an array of any of the above

Examples:

```text
assigneePerson
creatorPerson
participants
```

If no person handles are found, no notification is created.

The person who triggered the entity change is excluded from the resolved
recipients unless the subscription's **Notify also about own changes**
(`notifyActor`) checkbox is enabled. This applies to direct subscriptions and
reference automations. The option does not add recipients: the actor must be
selected by `recipientField` and still pass the automation's read-permission
check. Other recipients and existing inbox entries are not affected. New and
migrated Inbox subscriptions default to `notifyActor = false`.

## Open Task Events

Read acknowledgements use a conditional update scoped to the current recipient
and `isRead = false`, with an isolated entity manager. They do not flush unrelated
managed records. Repeating an acknowledgement preserves `readAt` and does not
emit another refresh event. Invalid or unowned handles return the existing
not-found error. The endpoint still returns the populated notification record.
The Inbox shares concurrent clicks on the same notification and removes the
entry only after success; failed acknowledgements remain retryable.

`OpenTaskEventsService` provides in-memory user-specific refresh notifications.

Behavior:

- clients subscribe per user handle
- subscription immediately emits once
- inbox creation/read changes notify affected users
- listeners are removed when the observable unsubscribes

This is a refresh signal, not the notification payload itself. Clients reload current inbox/open-task state after receiving it.

Change signals are deferred and coalesced per user over 25 ms, keeping snapshot
work out of the synchronous notification call. Initial subscriptions still emit
immediately. Each SSE connection runs at most one snapshot read at a time and
retains only one trailing refresh if more changes arrive while loading. This
preserves the latest state without accumulating stale full-snapshot reads.

Each snapshot reloads all task sections and unread notifications through a fresh
entity manager with request/transaction context resolution disabled and no
inherited transaction. Deferred signals can retain the triggering writer's async
context even after commit; reusing that context causes `Transaction is already
committed` and terminates the SSE stream. Snapshot reads must stay isolated from
the writer and from previously loaded snapshot entities.

## Frontend Behavior

The inbox uses the same `3xl` width and `90vh` height as the entity edit dialog.
`SaplingInboxWorkspace` presents a compact, paginated list with an independent
detail preview; selecting a row does not open or acknowledge the record. The
explicit open action keeps the existing entity routes, and marking a notification
read waits for success and remains retryable on failure.
Both actions sit in a fixed footer at the bottom right of the detail panel while
the content scrolls independently. Details use the shared Markdown renderer;
notifications retain `bodyText` for list previews and use `bodyMarkdown` for the
formatted detail view. Selected categories have a solid primary background and
a checkmark; view and period buttons also display a checkmark and solid fill.

Category cards toggle a single type filter with a visible pressed state. They
filter both open tasks and notifications (using the notification's source entity).
Counts on the cards reflect the active task/notification view before other filters.
Open tasks additionally offer all, overdue, today, upcoming, later and unplanned
views. Search matches all words across the title, description, date and context
labels. Filters combine; an empty result differs from an empty inbox and offers
a reset. Result counts expose the filtered and total number, so a daily view
does not imply the backlog has been completed. SSE refreshes retain filters and
keep selection and pagination within the current results.

The overdue-event bulk action is available in the overdue task view with no
category filter or the Events filter, and no text search. Its existing cutoff,
candidate count and confirmation still apply to all eligible overdue events.
On narrow screens, the detail preview appears below the scrollable list.

Selected notifications with an entity and record reference offer a quiet
**Change log** text action alongside **Open entry** in the detail footer. It
opens the existing record change-log dialog above the inbox, preserving selection,
filters and unread state. Old/new values are loaded only on demand through the
existing permission-aware change-log endpoint. The action opens the record's
history (newest first), not an assumed match between the latest change and the
notification. Task entries and notifications without a target reference do not
offer this action; no inline diff or automatic field highlighting is added.

The shared `useOpenTaskCountEvents` connection receives full snapshots through
the `open-task-snapshot` SSE event. A reconnectable transport interruption gets
15 seconds to recover automatically, so a brief backend restart does not produce
a persistent error message. Retries and `open` events do not extend that deadline;
only a valid streamed snapshot cancels it. A terminal connection failure,
server-sent `error`, or malformed snapshot is reported immediately. Reported
failures stop the initial loading display and show an inbox error.
The message center records one error per outage, including server diagnostics or
transport state, elapsed time, failed attempts, and browser online status.
A valid streamed snapshot clears the error and restores the inbox automatically.
The recovery timer is removed when the last subscriber unmounts.

If the inbox stays empty after an update, inspect the SSE error details and check
pending database migrations. In particular, `Migration20260905120000` adds
`notify_actor` to inbox and Teams subscriptions; without it, loading notifications
fails and the server cannot deliver the first snapshot.

The inbox UI is split into:

```text
frontend/src/components/account/SaplingInbox.vue
frontend/src/components/account/inbox/SaplingInboxSummaryCard.vue
frontend/src/components/account/inbox/SaplingInboxWorkspace.vue
frontend/src/components/system/header/SaplingHeaderInboxPreview.vue
frontend/src/composables/account/useSaplingInbox.ts
frontend/src/composables/account/useSaplingInboxWorkspace.ts
```

Navigation from a notification is built through `frontend/src/utils/inboxRoute.util.ts`, using `entity` and `referenceHandle`.
Open-task entities with dedicated snapshot entries, including tickets, events,
sales opportunities, effort estimates, and internal cases, also define explicit
route helpers for their header preview entries.
Event snapshot entries and event-backed inbox notifications use the dedicated
calendar route with the referenced handle. The calendar loads the event, moves
to its start date and time, and opens its edit dialog automatically. Tickets,
sales opportunities, effort estimates, and internal cases open the matching
partner workspace with the referenced record filtered and its edit dialog open.
Every persisted record dialog writes its handle to the `open` query parameter,
including dialogs opened directly in the calendar, table, or partner workspace.
This keeps an open dialog reloadable and makes its URL shareable. Closing the
dialog removes only `open`, preserving all filters and other route state so the
same inbox entry can be selected again.
Other entities continue to open their filtered generic table and record dialog.

Recurring Event snapshot entries additionally carry the first still-generated
occurrence start. Opening such an entry moves to that occurrence and directly
uses the existing single-occurrence detach workflow, so changing its status to
completed does not complete or otherwise edit the remaining series.

The overdue section also offers a bulk action for obsolete Event occurrences.
The user chooses an inclusive cutoff before today, sees the number of affected
occurrences, and confirms before any update is sent. Standalone Events use the
generic permission-aware bulk mutation endpoint. For every supported recurrence
frequency, generated occurrences through the cutoff use the batch detach endpoint
in groups of at most 200: each original start becomes a recurrence exception and
each detached Event is created with completed status. The series master and all
later occurrences remain open. A finite master is completed only after its last
generated occurrence was processed. Field permissions, change logs, calendar
delivery hooks, and open-task refresh events remain intact on both paths.

Completing existing Events changes only their status. An invalid historical
start/end range does not block that update when both dates remain unchanged;
the original dates are preserved rather than automatically corrected. Creating
Events or changing either date still requires a valid resulting range.

## Adding A New Entity To Inbox

1. Ensure the entity has a useful recipient relation such as `assigneePerson`, `creatorPerson`, or a participants collection.
2. Add an inbox template seed file in both production and demonstration when relevant.
3. Add an inbox subscription seed file in both production and demonstration.
4. Include relation expressions wherever notifications are triggered so placeholders can resolve needed fields.
5. Ensure frontend inbox route logic can navigate to the entity route.
6. Verify permissions allow recipients to open the referenced record.
7. Test with a realistic record in the demonstration seed data.

Recommended seed naming:

```text
inboxTemplate/inboxTemplateData_XXX.json
inboxSubscription/inboxSubscriptionData_XXX.json
```

## Common Mistakes

- Using a `recipientField` that resolves to a company instead of a person.
- Forgetting relation expressions needed by template placeholders.
- Creating templates for an entity but no active subscription.
- Creating notifications for users who cannot read the referenced record.
- Assuming open-task events contain data; they only signal that the client should refresh.
