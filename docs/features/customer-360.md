# Customer 360°

## Purpose

Customer 360 is the read-oriented relationship dossier for every `company` and `person`. It combines customer-facing activity, service, sales, contracts, contacts, documents, and the record-scoped internal `InformationItem` brief without replacing the existing generic tables and edit dialogs.

The frontend route is `/customer-360/:entityHandle/:handle`, where `entityHandle` is restricted to `company` or `person`.

## Customer relationship metadata

Customer-facing relationship properties carry the Sapling metadata option `isCustomer`. The marker identifies the business-side party of a record and must not be placed on internal responsibility properties.
Customer fields keep their `isCompany` or `isPerson` semantics, but must not
carry `isCurrentCompany` or `isCurrentPerson`: a new record must not silently
use the current user's company or person as its customer. Current markers remain
valid for internal responsibility fields such as assignees.

Current markers include:

- `creatorCompany` and `creatorPerson` on tickets, events, sales opportunities, and effort estimates;
- `customerCompany` and `customerPerson` on internal cases (Office tasks);
- `company` on contracts;
- `company` and `person` on inbound email;
- `customerCompany` and `customerPerson` on email deliveries.

`assigneeCompany` and `assigneePerson` represent internal ownership and never establish a customer relationship on their own. Future entities become Customer-360 capable by marking their actual customer relationship fields and adding the entity to the appropriate section/activity mapping in `Customer360Service`.

## Aggregation rules

- A company dossier includes direct company relationships and direct customer relationships of the company's contacts. Results are deduplicated by entity and handle.
- A person dossier includes direct person relationships and events where that person participates. It excludes activity belonging only to other contacts at the same company.
- Company contracts are shown in a person's dossier as explicit company context.
- Person master data includes a compact company context when it is readable.
- Sections and metrics are omitted when the current user cannot read the source entity.
- Generic row-level filters, security scripts, field projection, and Company/Person scope remain in force.
- Private events are visible only to their creator and participants.

## API

All endpoints are read-only and use the normal authenticated generic permission infrastructure:

- `GET /api/customer-360/:entityHandle/:handle/summary`
- `GET /api/customer-360/:entityHandle/:handle/activity?before=<ISO>&limit=30&kinds=...`
- `GET /api/customer-360/:entityHandle/:handle/related/:section?page=1&limit=20&filter=<JSON>`

Related-section filters are combined with the resolved customer scope using
`$and`; they can therefore narrow a section but never broaden it beyond the
current company or person. The frontend derives its compact filter chips from
the existing `isChip` entity metadata. Reference options with `isOpen: false`
are deselected initially, so closed tickets and opportunities stay hidden by
default while remaining explicitly selectable. Sections with a direct
`isActive` flag offer an additional closed-record toggle.

Allowed related sections are `contacts`, `tickets`, `opportunities`, `effortEstimates`, `contracts`, `documents`, and `relationships`.

## Email attribution

Outgoing `EmailDeliveryItem` records store indexed nullable `customerCompany` and `customerPerson` references. `CustomerAssociationResolverService` resolves these from the direct company/person source or from customer-marked fields on a ticket, opportunity, effort estimate, event, or contract. Mail follow-up events use the same attribution.

The activity feed reads full subject, body, recipients, delivery status, and attachments from the delivery record. Its shortened generated `EventItem` mail summary is deliberately excluded to prevent duplicate feed entries. Inbound messages use the existing `InboundEmailItem.company` and `.person` relationships; technical provider payloads are never exposed.

## Frontend behavior

The view is linked from company/person row actions, record actions, and CRM workspace account/person entries. Source records open in the existing table dialog. Quick actions reuse the mail composer and metadata-driven create dialog with customer company/person defaults. Action visibility comes from backend permission-derived flags.

The first load contains the summary and recent activity. Activity uses a cursor; related lists use page-based pagination. The page supports partial-permission, loading, empty, and error states and collapses to a single-column layout on small screens.
