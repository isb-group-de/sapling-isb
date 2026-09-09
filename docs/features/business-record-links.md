# Business record links and reference creation

The five header quicklinks expose effort estimates, appointments, tickets,
sales opportunities, and internal cases. Internal cases remain internal tasks,
approvals, and coordination work with their own status and responsibility. They
are not project containers and do not automatically close their related records.

## Owning relationships

- A ticket optionally references one sales opportunity.
- An effort estimate optionally references one ticket and one sales opportunity.
- An internal case optionally references one estimate, ticket, and opportunity.
- An appointment optionally references one case, estimate, ticket, and opportunity.
- Each relationship exposes its inverse collection on the referenced record.

Multiple appointments/cases can therefore belong to one estimate. Optional
links use `ON DELETE SET NULL`; deleting a referenced business record does not
delete appointments or work records. The new links are introduced by
`Migration20260909180000` and require the normal migration deployment.

## Context suggestions and validation

`@SaplingReferenceTemplate` mappings with `overwrite: false` suggest customer
and business context into empty, writable fields when selecting a reference or
creating a child from a relation tab. Picker rows are reloaded with readable
detail data before their context is used. Existing values are not overwritten.

Mappings with `validate: true` also enforce consistent nonempty references in
the generic backend mutation flow, including partial updates and relation
attachment. Validation follows optional intermediate context links and rejects
contradictory sources even when the local context field is empty. It reads
referenced records through the existing permission scope, does not persist
derived links, and reports the affected fields through the existing translated
`exception.referenceDependencyMismatch` error.

Customer company and ticket/opportunity/estimate links are validated. Contact
people can differ between records; for example, a meeting can have another
customer contact than its ticket. The existing company/person dependency still
applies. Responsibility is independent and is only suggested for direct creation.

## Direct and indirect navigation

`@SaplingRelatedRecords({ paths: [...] })` on an inverse collection declares
paths on its target entity that lead back to the current record. Persisted
dialogs show a separate **(indirect)** tab for these records. It has no relation
attach/detach/create actions; open a record to edit its actual owning link.

Rows and badge counts use the same nested OR filter, with server pagination,
field permissions, normal record visibility, and Event privacy. A record that
matches several paths appears once within that tab. A record linked both directly
and indirectly can appear in both tabs. Direct tabs retain their existing
mutation behavior. Empty unsaved parent dialogs have no indirect tabs.

## Direct creation from an empty reference

`@SaplingReferenceCreate()` opts a to-one field into the reference action's
empty-state **Create record** button. Without this decorator the empty-state
open action remains disabled. A selected record always offers the existing open
action. New records use the normal nested entity dialog and save lifecycle;
cancel does not create a record, and a successful save selects the persisted
record in the parent draft. Saving the reference does not save the parent.

Optional `defaults` map **new target field → current draft field**, for example:

```ts
@SaplingReferenceCreate({ defaults: { company: 'creatorCompany' } })
creatorPerson?: Rel<PersonItem>;
```

Defaults are copied only to known, persistent, insertable target fields; system,
read-only, security, and collection fields are excluded. Entity insert/read
permissions and parent field editability gate the action; backend permissions
remain authoritative. These metadata flags grant no additional permission.

The five business entities opt in customer/responsible companies and people,
and their to-one business references. Tickets also opt in contracts, prefilled
with the customer company. Statuses, types, categories, queues, SLA policies,
provider projections, and other configuration references are not opted in.

New Event business links are retained when detaching a recurring occurrence.
Translations for the new fields and indirect tabs are in seed file 093 in both
production and demonstration datasets.
