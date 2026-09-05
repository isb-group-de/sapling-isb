# Generic Record Merging

Every registered entity uses the same merge command. In a saved record's action
menu, **Merge records** opens a comparison with the losing record on the left and
the surviving record on the right. The action requires read, update and delete
permissions and is disabled while the edit form contains unsaved changes.

Choose a second record, optionally swap the sides, and compare. Each readable,
editable persistent value can be selected from either side. The survivor's value
is selected initially; an empty survivor value uses the losing value instead.
`null`, `undefined`, whitespace-only strings and empty arrays are empty; `false`
and `0` are values. System and read-only fields remain on the survivor. Active
custom fields participate in the same comparison. Collections are combined
automatically and do not have a field-side selector.

The final button explicitly says that merging deletes the losing record. The
survivor keeps its handle. A successful merge refreshes the parent view.

On narrow screens, the two values stack vertically and the full comparison body
scrolls beneath the dialog header. The deletion notice and final action stay
readable. Field choices expose their selected state to assistive technology;
Enter on a choice operates that button without submitting the dialog.
Datetime values use the same local timezone conversion as the edit form,
including daylight saving time and date changes around midnight.

## API

Both endpoints require an authenticated session or bearer token and the generic
permission checks:

```text
POST /api/generic/:entityHandle/merge/preview
{ "loserHandle": "123", "winnerHandle": "456" }

POST /api/generic/:entityHandle/merge
{
  "loserHandle": "123",
  "winnerHandle": "456",
  "previewToken": "<token returned by preview>",
  "selections": { "name": "winner", "street": "loser" }
}
```

Preview returns sanitized `loser` and `winner` snapshots, `fields` with templates,
values, selectability and defaults, and a token covering both server snapshots.
Save accepts source choices only; field values are read from the database. An
omitted choice uses the preview's default. The response contains `winner` and
`deletedHandle`. Numeric and string entity handles are supported.

A change to either record or its active custom values invalidates the preview
with HTTP 409 (`recordMerge.stalePreview`). Invalid pairs and field choices
return 400. Related record permissions and scopes are checked before and after
the reference change; missing access returns 403. Recompare after any failed save.

## Relationship and Transaction Contract

The backend discovers relationships from the complete MikroORM metadata map,
including relations hidden from the generated UI and unidirectional relations:

- Incoming owning to-one references move from the loser to the survivor. This
  preserves all inverse 1:M children, including appointments and time entries.
- Incoming and outgoing owning M:N collections are unioned by handle. Shared
  participants, roles and other links appear once. Self-references are normalized
  to the surviving handle.
- Polymorphic references declared with `@SaplingGenericReference` move by the
  entity and handle pair: documents, record history, notifications, phone calls,
  automation records and external import links retain their identities.
- Record notes (`InformationItem`) are moved or combined, winner content first,
  separated by a Markdown rule. References to a consolidated note are transferred
  too. Document file paths remain unchanged.
- Custom field storage rows are consolidated by definition. Selected active
  values are applied afterwards, including explicitly selected empty values.
  Inactive or read-only collisions retain the survivor's value; definitions only
  present on the loser are preserved.
- Derived search and vector entries for both records are invalidated. The normal
  survivor update queues rebuilding of its search data.

The command locks the pair in deterministic order and runs in a serializable
transaction. Related records use the normal generic update lifecycle with
permission checks. Dependency validation runs after the graph has been moved,
so a person/company pair can be transferred together without a transient filter
violation. Delete hooks are followed by a final reference check. The loser is
deleted before applying chosen scalar values to release its unique values.

Structural read-only references (such as an automation event's actor) can be
rebound by this internal identity operation. Explicit field permissions,
security fields, entity permissions and visibility scopes remain enforced.
When the initiating person is the loser, queued audit and notification effects
use the surviving person identity; authorization still uses the original
principal. An existing session may need a fresh login after that identity change.

Conflicting unique child records (including occupied 1:1 references) are never
silently deleted. The command fails with `recordMerge.referenceConflict` and the
entire transaction rolls back. Resolve those conflicting records first. Unknown
owning relation types that cannot use generic mutation fail safely too.

Database writes roll back together on any failure. Queued notifications,
indexing, file deletion and change logs run only after commit. Server scripts
must observe the existing `postCommitTasks` contract for external side effects.
The deleted identity is recorded as a `merge` history action on the survivor;
the final survivor update drives automation instead of a delayed delete event.

## Extension and Deployment

Implementation lives in `backend/src/api/generic/merge/`. The UI uses
`SaplingDialogRecordMerge.vue` and `useSaplingRecordMerge.ts`.
`SaplingMergeFieldChoice.vue` is shared with the existing concurrent-update
conflict dialog, retaining the same value rendering and framework styles.

New ORM relations are discovered automatically. A new polymorphic record
reference must declare `@SaplingGenericReference`; an undecorated string field
cannot be inferred to be a record identity. New auxiliary stores with unique
entity/reference keys need an explicit consolidation policy in the system
reference service.

No schema migration is required. Run the normal additive seed update for the
selected environment: both `json-production` and `json-demonstration` include
`translationData_074.json` (German and English) and
`changeLogActionData_002.json` (the `merge` history action). Existing executed
seed files are unchanged.

See [Generic API](../api/generic-api.md),
[Dynamic UI](../frontend/dynamic-ui.md), and
[Seeders and Migrations](../development/seeding-and-migrations.md).
