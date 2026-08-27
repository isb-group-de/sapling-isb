# SLA Deadlines And Business Calendars

Sapling derives a ticket's SLA policy and due dates while the ticket is saved in
`backend/src/script/TicketController.ts`. The policy is not a frontend-only
default: the backend resolves the current ticket input and persists the derived
values in the same generic create or update operation.

## Policy Resolution

The save hook keeps an explicitly selected SLA policy. Otherwise it resolves
support defaults from the selected/default contract and support queue. This
means contract-based SLA selection is visible after the first successful save,
not while an unsaved creation dialog is still being edited.

## Calendar Configuration

Each `SlaPolicyItem` optionally references:

- `workWeek`: the reusable `WorkHourWeekItem` whose daily `WorkHourItem`
  intervals count as SLA time
- `holidayGroup`: the reusable `HolidayGroupItem` whose holiday dates are
  skipped
- `timeZone`: the IANA time zone used to interpret the local work intervals,
  for example `Europe/Berlin`

Selecting a work week activates business-time calculation. Starting outside an
interval moves calculation to the next available interval. Remaining hours
continue over later days; days without an interval and dates in the holiday
group are skipped. IANA zone conversion accounts for daylight-saving changes.
When the time zone is empty or invalid, UTC is used defensively.

If no usable work week is selected, Sapling preserves the legacy behavior and
adds the configured hours directly to the ticket start date. A holiday group or
time zone alone does not change this fallback because no working intervals have
been defined.

## Persisted Deadlines

The same calendar calculation is applied to:

- `firstResponseDueAt`
- `resolutionDueAt`
- `deadlineDate` when it follows the resolution target

The deadlines are recalculated on insert and when contract, SLA policy, support
queue, support team, or ticket start date changes. Existing explicit deadline
values remain protected by the ticket save hook's established overwrite rules.

## Verification

Focused coverage lives in:

```text
backend/src/script/sla-deadline.utils.spec.ts
backend/src/script/TicketController.spec.ts
```

The cases cover elapsed-time fallback, after-hours starts, weekends, holidays,
daylight-saving transitions, and the integration of populated SLA calendar
relations into ticket persistence.
