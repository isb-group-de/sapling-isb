# Calendar And Recurrence

Sapling calendar events are normal metadata-driven entities with an additional delivery layer for external calendar systems. The internal event is the source of truth; Azure and Google synchronization are projections of that event.

Copies of an Event never inherit its `azure` or `google` projection. Those
inverse one-to-one references identify one provider item and remain attached to
the original Event; the copied Event receives a new provider reference when its
create delivery runs.

Outlook imports use the Microsoft Graph `iCalUId` as their canonical identity.
Graph `id` values identify mailbox-specific copies and are therefore different
for the organizer and attendees of the same meeting. `EventAzureItem` keeps the
Graph `id` in `referenceHandle` for provider updates and stores the shared
`iCalUId` for import upserts. The database enforces uniqueness for non-null
`iCalUId` values; legacy projection rows are backfilled on their next import.

## Main Files

```text
backend/src/entity/EventItem.ts
backend/src/entity/EventTypeItem.ts
backend/src/entity/EventCategoryItem.ts
backend/src/entity/EventStatusItem.ts
backend/src/entity/EventDeliveryItem.ts
backend/src/entity/EventDeliveryStatusItem.ts
backend/src/entity/EventAzureItem.ts
backend/src/entity/EventGoogleItem.ts
backend/src/calendar/calendar.recurrence.ts
backend/src/calendar/event.delivery.service.ts
backend/src/calendar/calendar.processor.ts
backend/src/calendar/calendar-delivery.executor.ts
backend/src/calendar/sync/
backend/src/calendar/azure/
backend/src/calendar/google/
frontend/src/composables/event/useSaplingEvent.ts
frontend/src/composables/event/useSaplingCalendarDrag.ts
frontend/src/composables/event/useSaplingEventContextMenu.ts
frontend/src/composables/event/useSaplingEventData.ts
frontend/src/composables/event/useSaplingEventPresentation.ts
frontend/src/composables/event/useSaplingCalendarNavigation.ts
frontend/src/composables/event/useSaplingEventEditor.ts
frontend/src/components/dialog/fields/SaplingFieldEventRecurrence.vue
frontend/src/utils/eventRecurrence.ts
frontend/src/utils/__tests__/eventRecurrence.test.ts
```

## Event Model

`EventItem` represents appointments, meetings, reminders, and related CRM/service events.

The `isDateStart`/`isDateEnd` metadata on `startDate` and `endDate` is an
enforced range invariant: an Event end may equal or follow its start, but may
never precede it. Generated dialogs validate the range inline and the generic
mutation path rejects invalid API, import, MCP, or script payloads as well.

Important fields:

| Field                               | Meaning                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `title`                             | Display title and primary value                                                                  |
| `description`                       | Markdown description; also part of AI vectorization                                              |
| `startDate`, `endDate`              | Event time range                                                                                 |
| `isAllDay`                          | Marks all-day events                                                                             |
| `isPrivate`                         | Marks owner-only events, including Outlook events imported with private sensitivity              |
| `recurrenceRule`                    | Optional RRULE string for recurring events                                                       |
| `recurrenceExceptionDates`          | Original occurrence starts removed from the series and represented by standalone Events          |
| `preparationDuration`               | Optional preparation block duration in 15-minute increments; defaults to `00:00`                 |
| `followUpDuration`                  | Optional follow-up block duration in 15-minute increments; defaults to `00:00`                   |
| `onlineMeetingURL`                  | Optional meeting link                                                                            |
| `type`                              | Appointment type; defaults to `Online` and controls default-calendar and online-meeting behavior |
| `category`                          | Business category combined with the appointment type; defaults to `Intern`                       |
| `status`                            | Current event status; `EventStatusItem.isOpen` controls the default open-status calendar filter  |
| `assigneeCompany`, `assigneePerson` | Internal owner                                                                                   |
| `creatorCompany`, `creatorPerson`   | Creator context                                                                                  |
| `ticket`                            | Optional ticket relation                                                                         |
| `salesOpportunity`                  | Optional sales opportunity relation                                                              |
| `participants`                      | Person collection for attendees                                                                  |
| `azure`, `google`                   | External calendar projection records                                                             |

A ticket-linked Event may retain the Ticket's exact `creatorCompany` and
`creatorPerson` pair when a contact's current Company has changed since the
Ticket was recorded. The backend verifies that both submitted references still
match the referenced Ticket. Events without that provenance continue to require
the selected creator Person's current Company.

### Preparation And Follow-Up Blocks

`preparationDuration` and `followUpDuration` are properties of the main
`EventItem`. They do not create additional entity records. For timed events, the
Sapling frontend derives a visual placeholder immediately before and/or after
every visible main-event occurrence.

Derived placeholders have no entity handle and are excluded from editing,
dragging, resizing, context menus, agenda lists, and event counters. Moving or
resizing the main event automatically changes their position because their
dates are recalculated from the main event. Recurring events receive fresh
placeholders for each expanded occurrence.

Preparation and follow-up placeholders are currently Sapling-only. Azure and
Google calendar delivery continues to synchronize only the main `EventItem`;
the derived placeholders do not create deliveries, invitations, notifications,
or external calendar entries.

`EventTypeItem.showInDefaultCalendar` is important for delivery. If it is `false`, the event stays in Sapling and is not queued for external default-calendar synchronization. `EventCategoryItem` is independent of delivery behavior and classifies the business context, for example `Support` together with the type `Review`.

## Recurrence Contract

Sapling stores recurrence in `EventItem.recurrenceRule` as an RFC5545-like RRULE string. The backend parser accepts rules with or without the `RRULE:` prefix and normalizes the supported parts.

Supported RRULE parts:

| Part       | Supported values                                            |
| ---------- | ----------------------------------------------------------- |
| `FREQ`     | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`                      |
| `INTERVAL` | Positive integer                                            |
| `BYDAY`    | Weekday list using `MO`, `TU`, `WE`, `TH`, `FR`, `SA`, `SU` |
| `COUNT`    | Positive integer occurrence limit                           |
| `UNTIL`    | UTC end date in compact RRULE format                        |

External providers receive provider-specific forms:

| Provider | Conversion                                                                          |
| -------- | ----------------------------------------------------------------------------------- |
| Google   | `buildGoogleRecurrence()` returns `["RRULE:<rule>"]`                                |
| Azure    | `buildAzureRecurrence(startDate, rule)` returns a Microsoft Graph recurrence object |

Azure conversion maps:

| Frequency | Azure behavior                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------ |
| `DAILY`   | `daily` pattern                                                                                  |
| `WEEKLY`  | `weekly` pattern with `daysOfWeek`; falls back to the start date weekday when `BYDAY` is missing |
| `MONTHLY` | `absoluteMonthly` pattern on the start date day                                                  |
| `YEARLY`  | `absoluteYearly` pattern on the start date month/day                                             |

The frontend recurrence UI builds the same persisted RRULE string. Keep frontend and backend parsers aligned whenever recurrence semantics change.

### Editing One Occurrence

Opening a generated occurrence asks whether the user wants to edit that
occurrence or the entire series. Series editing keeps the existing master-event
workflow. Occurrence editing opens a standalone draft at the selected generated
start and persists it through:

```text
POST /api/calendar/events/:handle/detach-occurrence
```

The command validates that `occurrenceStart` is still generated by the current
RRULE and uses optimistic concurrency against the series master. In one database
transaction it appends the original start to `recurrenceExceptionDates` and
creates the edited Event with no recurrence rule. Calendar delivery tasks are
released only after that transaction commits. The frontend recurrence expander
omits exception timestamps, so the standalone Event replaces the generated
occurrence without a duplicate.

Provider behavior is intentionally provider-specific:

- Google receives the master RRULE plus RFC5545 `EXDATE` lines and the detached
  Event is inserted as a normal standalone Google event.
- Outlook lists the master event's instances through Microsoft Graph, deletes
  the instance matching the original start, and creates the detached Event as a
  normal standalone Outlook event. When no master projection exists yet, it is
  created first and the selected instance is removed immediately.

Provider imports collapse expanded recurring instances back to their master.
Sapling-created detached provider events remain standalone and continue to match
their own `EventAzureItem` or `EventGoogleItem` reference. Google master imports
also restore RRULE and EXDATE data, while Outlook imports preserve Sapling's
persisted exception timestamps because Graph recurrence patterns do not expose
EXDATE on the master.

Open-task Inbox entries resolve a recurring Event to its first occurrence that
is not listed in `recurrenceExceptionDates`. The Inbox route carries that exact
occurrence start into the calendar and opens it directly as a standalone draft.
Completing the draft therefore detaches only that occurrence; the series remains
unchanged and the Inbox advances to the next generated occurrence. Normal clicks
on recurring calendar entries continue to offer the existing choice between the
single occurrence and the whole series.

## Delivery Flow

Calendar delivery starts after an event change asks for synchronization.

1. `EventDeliveryService.queueEventDelivery(event, payload)` checks whether the event type is visible in the default calendar.
2. A pending `EventDeliveryItem` is persisted with the event and payload.
3. If Redis/BullMQ is enabled, the `calendar` queue receives a `deliver-calendar-event` job.
4. If Redis is disabled, `CalendarDeliveryExecutor.execute()` runs directly as a synchronous fallback.
5. `CalendarProcessor` executes queued jobs and passes the delivery id to the executor.
6. Azure and Google services update or create provider-side calendar items and persist `EventAzureItem` / `EventGoogleItem` references.

Update deliveries carry the fields whose persisted values actually changed.
Provider updates are built as focused patches from that list instead of
resending the complete Event. In particular, category/type classification or a
date move does not resend the unchanged attendee collection. Participant
changes send an attendee-only patch, while title, description, time, and
recurrence changes send only their corresponding provider fields. Google uses
`sendUpdates: none` for classification-only patches and `sendUpdates: all` for
guest-visible changes, creation, and cancellation. This distinction prevents
an unchanged attendee list from being interpreted as attendee removal and
generating misleading cancellation mail.

The Event lifecycle filters internal-only updates before delivery creation.
Ticket, sales-opportunity, ownership, preparation/follow-up, custom-field, and
other Sapling-only changes therefore create no `EventDeliveryItem`, do not
resolve a provider token, and do not call Outlook or Google. Provider-relevant
updates are currently limited to title, description, start/end, recurrence,
participants, type/category classification, and status lifecycle changes.

Retries use `EventDeliveryService.retryDelivery(handle)`. The delivery is reset to pending, `nextRetryAt` is cleared, and the same queue-or-direct execution path is used.

If an active Sapling Event still has an Azure reference but Microsoft Graph
reports that the Outlook object no longer exists, Sapling removes the stale
reference and creates a new Outlook event in the same delivery. Other provider
errors remain failed deliveries with the actual provider error; Sapling does
not generate a non-executable e-mail/ICS fallback payload.

## Provider Import

The calendar page can manually fetch external provider events for the currently visible date range through:

```text
POST /api/azure/events/import
POST /api/google/events/import
```

The Azure endpoint uses the signed-in user's stored Microsoft session (`PersonSessionItem`) and Microsoft Graph calendar view. Returned Outlook items are matched by `EventAzureItem.referenceHandle`. The Google endpoint uses the signed-in user's stored Google session and Google Calendar events list. Returned Google items are matched by `EventGoogleItem.referenceHandle`.

The provider services own network calls, token refresh, orchestration, and
persistence. `azure-calendar.utils.ts` and `google-calendar.utils.ts` keep each
provider's response normalization and outbound event mapping explicit and
independently testable; they intentionally do not force unlike provider payloads
through one shared abstraction.

Microsoft Graph `calendarView` expands a recurring Outlook series into
individual `occurrence` and `exception` resources. Before persistence, the
Azure importer groups those resources by `seriesMasterId`, loads each series
master once, and uses the master id as the provider reference. A Sapling series
therefore remains one recurring Event instead of producing one standalone Event
per visible occurrence. Supported recurrence patterns on previously unknown
Outlook series are converted to Sapling's RRULE format. Occurrence-level Outlook
exceptions created outside Sapling are not materialized as separate Sapling
Events. Occurrences explicitly detached in Sapling are standalone provider
events and therefore remain standalone on later imports.

Existing Sapling events are updated and unknown provider items are created with the user's configured default type (`online` by default) and category (`internal` by default). Outlook updates preserve the existing Sapling event type and category; Outlook classification mappings and defaults are applied only when an external item is imported for the first time. Known attendee email addresses are linked as participants through an exact, case-insensitive match. A provider attendee is linked only when that normalized email belongs to exactly one `PersonItem`; ambiguous duplicate addresses are skipped. The current user is always added as a participant so imported events appear in their calendar filter.

Outlook events whose Microsoft Graph `sensitivity` is `private` are imported with `EventItem.isPrivate = true`. Sapling still stores the full event details for the importing owner, but generic Event reads, exports, relation mutations, updates, deletes, KPIs, and timeline anchor loads must only expose private events when `creatorPerson` is the current user. Non-private events keep the normal Event permission behavior.

Outlook imports store the direct online-meeting join link in
`EventItem.onlineMeetingURL`. The structured Microsoft Graph
`onlineMeeting.joinUrl` value has priority. For forwarded or externally
organized invitations where Graph omits that value, the importer also checks
URL-based locations and recognized meeting links in the HTML body, unwrapping
Outlook Safe Links before persistence. Unrelated links from signatures are not
used as meeting URLs.

The manual endpoints are user-triggered; optional polling reuses the same import services. Neither mode requires provider webhooks, and both rely on the existing Microsoft or Google login scopes instead of a separate calendar-only setup.

## Automatic Calendar Import and Classification

Automatic Outlook or Google polling is configured per user through `CalendarSyncSubscriptionItem`. The account dialog exposes the current user's subscription through:

```text
GET /api/current/calendarSync
PATCH /api/current/calendarSync
```

The subscription stores the connected provider, whether automatic import is active, the import range (`day`, `week`, or `month`), the polling interval in minutes, and the latest run/result metadata. Tokens remain in `PersonSessionItem`; the subscription only references the person.

When Redis is enabled, `CalendarSyncModule` registers a BullMQ `calendar-sync` queue. On startup it adds a repeatable `schedule-calendar-imports` job, which finds due active subscriptions and enqueues one `import-calendar-for-subscription` job per user. Each import job dispatches to the same Azure or Google import path as the corresponding manual import button. When Redis is disabled, automatic import is not scheduled.

The account dialog also configures fallback type/category values and provider classification mappings:

- Outlook maps its native category names to a Sapling event type, category, or both when the Outlook item is first imported. Later imports update the linked event's provider-owned fields but preserve the event type and category selected in Sapling. The account dialog can load `/me/outlook/masterCategories` and add missing display names as mapping rows; this requires the delegated `MailboxSettings.Read` scope. Matching names are written back to Outlook when Sapling creates or updates the event.
- Google maps calendar color IDs (`1` through `11`) to a Sapling event type, category, or both. Sapling-created Google events additionally carry the exact handles in private `extendedProperties`, so a later import does not lose the classification even when a color represents only one combined mapping.
- Provider items without a matching mapping use the configured defaults. Existing linked Google events are reclassified when a later import reads them again; existing linked Outlook events retain their Sapling classification.

Private Outlook events use the same automatic import path as manual imports, so privacy behavior is identical for both flows.

## Frontend Behavior

`useSaplingEvent.ts` composes the calendar view behavior:

- Load events and recurring series for the visible range.
- Expand recurring events for display.
- Create and update calendar events.
- Manually fetch Azure or Google events for the visible range and refresh the calendar.
- Skip external-calendar assumptions for event types where `showInDefaultCalendar` is `false`.
- Keep non-recurring edits separate from recurring occurrence handling.

The calendar toolbar keeps the same compact, non-scrolling height in day,
workweek, week, and month views. Width-dependent actions move into the overflow
menu instead of making the toolbar itself scroll.

The overflow menu also lets each browser choose how simultaneous timed Events
are arranged. **Stack appointments** uses Vuetify's compact overlapping stack;
**Appointments side by side** assigns equal non-overlapping columns. The chosen
calendar type, combined/person-column layout, standard/extended mode, and
overlap arrangement are persisted together in local storage. A narrow viewport
temporarily uses the day and combined layout without overwriting the saved
desktop preference; its menu omits the other period and person-column choices
because the mobile calendar is intentionally limited to one day.

`SaplingCalendarTutorial.vue` provides first-visit onboarding for `/event` and
can be restarted independently from the command palette. Its targets cover the
visible period, navigation, display and view controls, calendar grid, entries,
agenda, and filters. During the agenda/filter steps it asks
`SaplingEventContextPanels.vue` to expose the corresponding panel so the
spotlight always references visible UI. Stable `data-tutorial` hooks are part of
this onboarding contract and should be preserved when the calendar layout is
refactored.

`useSaplingCalendarDrag.ts` owns timed-event pointer interactions: new drafts,
move/resize state, readonly guards, forced dirty fields, synthetic click
suppression, translucent drag colors, cancellation, and rollback snapshots. It
accepts calendar/dialog refs plus one persisted-editor callback, so the gesture
logic can be reused independently of calendar loading and persistence.
Resizable timed events expose their complete lower card edge as the resize
target. The hit area remains inside the individual card so overlapping events
retain their normal hover and click stacking order.
Event detail tooltips close immediately when dragging, resizing, opening the
editor, or opening the context menu starts. Their teleported overlay also stops
accepting pointer events for the complete lifetime of those interactions.
Dragging or resizing one expanded recurrence occurrence updates every rendered
occurrence of the same series as a live preview. When the edit dialog opens,
the occurrence delta is applied to the persisted series start instead of
turning the selected occurrence into a new series anchor.

`useSaplingEventContextMenu.ts` owns the shared record-action projection,
script-button loading/execution, permissions, positioning, and the copy,
timeline, change-log, navigation, document, upload, information, and mail
actions. Event loading and calendar refresh stay behind callbacks, so the menu
workflow is separate from the calendar's query and persistence lifecycle.

`useSaplingEventData.ts` owns visible-range queries, participant and chip
filters, selected-person hydration, holiday loading, recurrence expansion, and
the final calendar-mode/workweek filtering. `useSaplingEventPresentation.ts`
projects that loaded state into range/month labels, agenda cards, hero stats,
person columns, participant labels, holiday groups, and side-by-side drafts.
Calendar cards keep the three event classifiers visually distinct: the event
type provides the card background, the status provides the left accent strip,
and the category provides the colored leading icon. The bounded event list
projection therefore requests the nested appearance fields for all three
references explicitly.

`useSaplingCalendarNavigation.ts` owns the date anchor, day/week/month shifts,
current-time and selected-event-time scrolling, scroll cleanup, and work-hour
overlays. Calendar deep links use `?open=<eventHandle>`; the referenced event is
loaded independently of the visible range, its start date/time becomes the
calendar focus, and its edit dialog opens automatically. Opening any persisted
calendar event also writes this parameter, so the active dialog survives reloads
and its URL can be shared. Closing the dialog removes only `open`. Relation
tables inside the Event dialog keep their own edit dialogs local; opening a
participant or another related record must not replace the Event handle in the
calendar URL.

`useSaplingEventEditor.ts` owns record hydration, create/update persistence,
participant references, route-driven opening, drag rollback, optimistic local
replacement, and update-conflict reload/merge behavior. `useSaplingEvent.ts`
is now a sub-600-line composition shell for these focused workflows.
Opening an expanded occurrence without a drag always edits the canonical
persisted series record and keeps its original `startDate`/`endDate`. This
prevents opening and saving a later occurrence from shifting the complete
series forward.

Finite recurring series can be converted into standalone Events through the
calendar card context menu:

```text
POST /api/calendar/events/:handle/materialize-recurrence
```

The endpoint requires Event insert permission at the route boundary and applies
the normal Event update and create permission checks and mutation lifecycles.
It clears the source Event's recurrence rule and creates one Event for every
later occurrence in a single database transaction. Participants and the
business, ownership, classification, duration, privacy, and reference fields
are copied. The request may include `expectedUpdatedAt` for optimistic
concurrency.

Materialization is an internal structural conversion, not a second user
notification signal. It therefore suppresses lifecycle-driven Inbox, Teams, and
email notifications for the source update and generated Events. Entity hooks
and webhooks still run, so downstream integrations and external calendar
synchronization remain active. Azure/Google delivery creation
is collected as post-commit work and starts only after the complete
materialization transaction has committed; Redis workers can therefore resolve
every delivery and Event id.

The source delivery also carries an explicit recurrence-removal operation.
Outlook first receives a focused `recurrence: null` patch for the existing
series master; Google receives an empty recurrence array. Because
materialization does not change any other source fields, no second provider
update is sent. Later occurrences are delivered as new standalone events.

Open-ended series cannot be completely materialized and must first receive a
`COUNT` or `UNTIL` limit. Series above the shared 100-occurrence calendar limit
are rejected instead of being partially converted. The resulting standalone
Events can be edited or completed independently.

New events persist their participant handles in the initial generic create
request. They must not add the same participants through follow-up relation
requests, because relation mutations intentionally run the event `afterUpdate`
lifecycle and would emit misleading update notifications immediately after the
create notification.
Existing-event saves determine update mode from the canonical editor record,
not from the generic form payload: update payloads intentionally omit the
primary key. They must never fall back to the calendar's selected-person filter
or include `participants` unless the participant relation itself was changed.
The people selected in the calendar filter are also copied into the local Event
draft as hydrated participant records. The create dialog therefore shows them
immediately in its participants relation tab, where they can be reviewed or
removed before the same handles are sent in the initial create request.
Saving never falls back to the calendar filter or derives participants from the
assignee or creator. An explicitly emptied participant list stays empty. The
signed-in person is therefore included only when they remain in the participant
list copied from the current calendar filter selection.

Deleting an Event through the generic record UI first inspects whether it has an
Azure/Google reference or Event delivery history. Synchronized Events are not
physically deleted. The delete action updates their status to `canceled`, which
runs the standard `afterUpdate` delivery and removes the provider-side Outlook
or Google appointment. The Sapling Event and its delivery history remain for
auditability, while closed-status calendar filters hide it from the normal
calendar view. Unsynchronized Events retain the normal physical delete path.
An Outlook `404 ErrorItemNotFound` during cancellation means the provider item
is already absent: Sapling treats that response as a successful, idempotent
deletion and removes the stale Azure projection instead of failing the delivery.

Completing and canceling an Event have intentionally different external
calendar semantics. Status `completed` is an internal Sapling workflow action:
it creates no calendar delivery, leaves an existing Outlook/Google appointment
and its provider reference untouched, and therefore sends no cancellation or
meeting update to attendees. Status `canceled` keeps the external deletion path
described above. Azure and Google imports preserve an existing Sapling
`completed` status while the provider item remains active, so polling cannot
reopen the completed Event as `scheduled`; an actual provider-side cancellation
may still change it to `canceled`.

`SaplingFieldEventRecurrence.vue` is the editable recurrence field used by generic dialogs. Shared parsing and expansion helpers live in `frontend/src/utils/eventRecurrence.ts`.

The shared work filter used by calendar and partner views includes one
multi-select group for each `m:1` or `1:1` reference marked with
`@Sapling(['isChip'])`. For reference records with an `isOpen` boolean, the
initial selection uses records where `isOpen` is `true`; other chip filters
start with all reference records selected. Generic tables apply the same
`isOpen` convention to `m:1` chip references as a visible default column filter;
references without an `isOpen` field keep the previous all-values behavior. An
all-closed catalog intentionally starts with no checkbox selected and a
no-match filter; it must never fall back to selecting the closed values. Status
catalogs expose `sortOrder` as their only ordering marker, and seeded values are
initially numbered alphabetically in steps of ten so administrators can adjust
their order later.

The employee area also provides one compact segmented control directly below its
accordion header. Its `Alle`, `Nur ich`, and `Keine` presets use the shared
calendar toggle pattern. `Nur ich` resets the complete people selection to the
signed-in person. `Alle` and `Keine` add or remove every person from the current
user's company across all backend pages while preserving selected external
people. Global person and company lists intentionally have no bulk action
because they can contain very large result sets.

## Extension Checklist

When changing recurrence:

1. Update `backend/src/calendar/calendar.recurrence.ts`.
2. Update `frontend/src/utils/eventRecurrence.ts`.
3. Update `SaplingFieldEventRecurrence.vue` if the UI needs new controls.
4. Add or update backend recurrence tests.
5. Add or update frontend recurrence tests.
6. Check Azure and Google provider conversion explicitly.

When adding a new calendar-related entity or status:

1. Add the entity file and registry entry.
2. Add entity, route, translation, and permission seed files.
3. Add migration only if the database schema changes.
4. Decide whether it participates in external delivery.
5. Document queue behavior if delivery semantics differ from `EventDeliveryItem`.

## Verification

Useful targeted commands:

```powershell
npm test --prefix backend -- calendar.recurrence.spec.ts calendar.processor.spec.ts calendar-delivery.executor.spec.ts event.delivery.service.spec.ts --runInBand
npm test --prefix backend -- calendar-sync-subscription.service.spec.ts calendar-sync.processor.spec.ts --runInBand
npm test --prefix backend -- azure.calendar.controller.spec.ts google.calendar.controller.spec.ts --runInBand
npm run type-check:backend
npm run type-check:frontend
.\node_modules\.bin\vitest.cmd run src\utils\__tests__\eventRecurrence.test.ts
```

Run provider-specific tests when changing payload mapping, credentials, webhook behavior, or external calendar IDs.
