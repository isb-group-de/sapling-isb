# Automation plan and execution evidence

Administrators can open **Automatisierungen** from a table's toolbar, a row menu,
or a record dialog menu. The shared dialog is loaded on demand and provides a graph,
an equivalent keyboard-accessible rule list, and per-record history.

The dialog uses the same `3xl` width and `SAPLING_DIALOG_HEIGHT.xl` (90vh)
as the record editor. The graph fills the remaining space and scrolls independently.
The shell shares its padding, `SaplingDialogEditHero` and `SaplingActionBar` with
the existing dialog design. History pagination stays in the footer. Its information
notice takes only its content height; independent email evidence is rendered using
`SaplingDataTable`, with date, subject, recipients, status and attempt count. Subject
links open the existing delivery table filtered to the exact record. These remain
delivery records without a reconstructed chain, not a list of all ticket emails.
Rule details are a separate component with a fixed header and an immediately
accessible rule-opening action; only the detail body scrolls.
Opening rule details keeps a usable graph viewport. Each rule occupies one lane,
with aligned condition, reference and action columns even when optional steps are
absent. Labels wrap to three lines; full text remains accessible through the node
label and tooltip. Pointer hover and keyboard focus highlight the relevant rule's
connections. Possible follow-up edges use separate tracks outside the nodes;
they retain their dashed appearance and do not imply a guaranteed execution.

`GET /api/automation/graph/:entityHandle?depth=1&includeInactive=false` adapts existing
field automations and Inbox, email, Teams and webhook subscriptions into events,
rules, conditions, reference paths and actions. It includes both outgoing rules and
rules targeting the selected entity. There is no separate workflow definition to maintain.

Field changes can lead to subsequent `afterUpdate` events. Those edges express possible
dependencies, not a shared transaction or guaranteed delivery order. Conditions preserve
scope, AND/OR groups, operators and values; rule details include priority, recipients,
template, activation and repeat suppression. Reference labels use ordinary entity metadata
and value lookups. Deleted or unavailable references remain visible as raw identifiers.
Reference labels are resolved on opening the graph, with shared metadata requests,
deduplicated values and a maximum of 200 value lookups per graph response.

Expansion is bounded to depth 8 and 200 nodes per response. Repeated events are shared;
actual cycles are marked. Truncated responses expose continuation entities. Configuration
links open the existing generic rule table filtered to the rule's handle.

`GET /api/automation/history/:entityHandle/:recordHandle?page=1` returns up to 25
executions and 25 separate email deliveries per page, with independent totals and
`hasMore`. Executions match the source record or a target record. Event IDs and chain IDs
provide exact grouping; Teams and webhook deliveries join by the recorded deduplication
key. Processing status and actual delivery status are shown separately.

Email processing remains a separate subsystem. Email deliveries without a reliable event
link appear as independent operations. No time-proximity correlation is invented.
Missing execution records mean **not documented**, never automatically **skipped**.

New executions store the compact rule configuration that was evaluated. New email
deliveries also retain their subscription snapshot. Existing rows remain nullable:
current configuration must not be substituted for unknown historical configuration.
Both inspection endpoints enforce session/token authentication and administrator
permission directly, independently of whether their menu items are visible.

`node backend/maintenance/verify-automation-graph.cjs` verifies the compiled adapters
against the supplied database in a read-only transaction. The existing ticket graph
contained 24 nodes and 22 edges, including incoming document field/inbox rules and
the possible subsequent ticket update event.
