# Mail And Teams Communication

Sapling communication is built around message templates, rendered entity context, persisted delivery records, provider-specific dispatch, and inbound mailbox synchronization. Email can be manually previewed and sent from the UI; incoming mail can be archived and processed by Songbird; Teams messages are subscription-driven lifecycle notifications.

## Main Files

```text
backend/src/api/mail/mail.controller.ts
backend/src/api/mail/mail.service.ts
backend/src/api/mail/mail-rendering.service.ts
backend/src/api/mail/mail-provider-session.service.ts
backend/src/api/mail/mail-provider-transport.service.ts
backend/src/api/mail/mail-follow-up.service.ts
backend/src/api/mail/mail.processor.ts
backend/src/api/mail/dto/mail.dto.ts
backend/src/api/mail/markdown.util.ts
backend/src/api/teams/teams.service.ts
backend/src/api/teams/teams.processor.ts
backend/src/api/template/message-template.service.ts
backend/src/entity/EmailTemplateItem.ts
backend/src/entity/EmailSubscriptionItem.ts
backend/src/entity/EmailDeliveryItem.ts
backend/src/entity/EmailDeliveryStatusItem.ts
backend/src/entity/EMailListItem.ts
backend/src/entity/SharedMailboxItem.ts
backend/src/entity/SharedMailboxGroupItem.ts
backend/src/entity/SharedMailboxContextItem.ts
backend/src/entity/TeamsTemplateItem.ts
backend/src/entity/TeamsSubscriptionItem.ts
backend/src/entity/TeamsDeliveryItem.ts
backend/src/entity/TeamsDeliveryStatusItem.ts
frontend/src/components/dialog/SaplingDialogMail.vue
frontend/src/components/dialog/mail/
frontend/src/composables/dialog/useSaplingMailDialog.ts
frontend/src/services/api.mail.service.ts
frontend/src/components/dialog/fields/SaplingFieldTeamsRecipient.vue
```

Incoming Azure/Google synchronization and AI-driven ticket, opportunity, or
office-task processing are documented separately in
`docs/features/inbound-email.md`.

Seed files:

```text
backend/src/database/seeder/json-production/emailTemplate/
backend/src/database/seeder/json-production/emailList/
backend/src/database/seeder/json-production/teamsTemplate/
backend/src/database/seeder/json-production/teamsSubscription/
backend/src/database/seeder/json-production/teamsDeliveryStatus/
backend/src/database/seeder/json-demonstration/emailTemplate/
backend/src/database/seeder/json-demonstration/teamsTemplate/
backend/src/database/seeder/json-demonstration/teamsSubscription/
```

## Shared Template Context

Mail and Teams use `MessageTemplateService`.

Template context can contain:

- the target entity record loaded by `entityHandle` and `itemHandle`
- `currentUser`
- optional draft values from the client
- populated relation paths requested by subscription recipient fields

Placeholders use `{{path.to.value}}` syntax. Date fields can be formatted through formatters such as:

```text
{{startDate|date}}
{{updatedAt|datetime}}
```

Markdown is rendered to HTML by the shared renderer. Mail additionally creates a plain-text representation for MIME messages.

## Email Model

`EmailTemplateItem` defines reusable email content.

| Field             | Meaning                           |
| ----------------- | --------------------------------- |
| `name`            | Template name                     |
| `description`     | Optional explanation              |
| `subjectTemplate` | Placeholder-enabled subject       |
| `bodyMarkdown`    | Placeholder-enabled markdown body |
| `isDefault`       | Candidate default template        |
| `isActive`        | Allows disabling without deleting |
| `entity`          | Entity context for the template   |

`EmailDeliveryItem` is the persisted dispatch record.

| Field                                                   | Meaning                                          |
| ------------------------------------------------------- | ------------------------------------------------ |
| `status`                                                | Pending, success, failed                         |
| `template`                                              | Optional source template                         |
| `entity`                                                | Target entity                                    |
| `createdBy`                                             | Sending user                                     |
| `referenceHandle`                                       | Target record handle as string                   |
| `provider`                                              | User/provider handle such as `azure` or `google` |
| `toRecipients`, `ccRecipients`, `bccRecipients`         | Resolved recipients                              |
| `subject`, `bodyMarkdown`, `bodyHtml`                   | Rendered message                                 |
| `attachmentHandles`                                     | Document handles attached to the message         |
| `requestPayload`                                        | Provider-independent audit payload               |
| `responseStatusCode`, `responseBody`, `responseHeaders` | Provider result                                  |
| `providerMessageId`                                     | External message id when available               |
| `attemptCount`, `nextRetryAt`, `completedAt`            | Delivery lifecycle fields                        |

`EmailSubscriptionItem` configures automatic email delivery for generic entity
mutations.

| Field            | Meaning                                                         |
| ---------------- | --------------------------------------------------------------- |
| `description`    | Human-readable rule name                                        |
| `entity`         | Page/entity being observed                                      |
| `type`           | Lifecycle trigger, usually `afterInsert` or `afterUpdate`       |
| `recipientField` | Context path resolving a `PersonItem` or email address          |
| `senderPerson`   | Sapling user whose Azure/Google session authenticates the send  |
| `senderMailbox`  | Optional assigned shared mailbox used as the visible sender     |
| `template`       | Entity-dependent email template                                 |
| `conditions`     | Optional list of observed fields with old/new value constraints |
| `isActive`       | Enables/disables the rule                                       |

## Email Flow

Manual email sending goes through `MailController`.

| Endpoint                 | Permission                      | Purpose                                                                         |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------- |
| `GET /api/mail/senders`  | Authenticated user              | Lists available sender addresses and applies an optional entity-context default |
| `POST /api/mail/preview` | `allowRead` on `entityHandle`   | Resolves recipients, subject, markdown, HTML, and attachments                   |
| `POST /api/mail/send`    | `allowUpdate` on `entityHandle` | Persists and queues/sends an email delivery                                     |

`MailService.sendEmail()` always renders through preview first. It then persists an `EmailDeliveryItem` with pending status. If Redis is enabled, a BullMQ `emails` job is queued. If Redis is disabled, dispatch runs immediately.

`MailService` is the stable orchestration facade used by controllers,
processors, and inbound synchronization. Its collaborators own one boundary
each:

- `MailRenderingService` builds template context and renders recipients,
  subject, markdown, and HTML.
- `MailProviderSessionService` loads the current mail person, discovers allowed
  senders, and owns Azure/Google token refresh.
- `MailProviderTransportService` loads attachments and sends provider-specific
  Graph or Gmail payloads, including one authentication retry.
- `MailFollowUpService` creates the completed communication event without
  allowing event failures to change a successful delivery result.

Provider dispatch supports:

| Provider | Behavior                      |
| -------- | ----------------------------- |
| Azure    | Sends through Microsoft Graph |
| Google   | Sends through Gmail API       |

After successful dispatch, Sapling creates a completed `EventItem` of type `mail` as a communication follow-up. Failures are persisted on the delivery record.

Persisted email deliveries are also shown in the generic record edit dialog's
**Emails** tab. The embedded list filters `EmailDeliveryItem` by the current
record's `entity` and `referenceHandle`. Its compose action reuses the global
mail composer with the current record context, so recipient suggestions,
templates, sender resolution, attachments, and normal mail permissions remain
unchanged. Every populated field marked `isMail` on the edited main record is
passed to the composer as an initial **To** recipient; multiple mail fields
preselect multiple recipients. The tab is omitted when no populated `isMail`
field exists. Composer and phone-call hero labels use `isValue` metadata
from the record that owns the active contact field. Direct fields use the edited
record; non-persistent named assistants resolve their master reference and its
target templates rather than entity-specific field-name guesses. Reference
fields marked `isValue` are excluded from communication hero labels; only
scalar value fields contribute to the displayed name.

Every direct many-to-one Company relation exposes a read-only, non-persistent
`<relationName>Email` assistant field (for example `PersonItem.companyEmail`
or `TicketItem.creatorCompanyEmail`). These fields mirror the referenced
Company's `email`, are available as table columns, and participate in the same
metadata-driven mail actions as direct email fields. Mail projections are loaded
for row actions even when a personal table configuration hides the column.
Consequently, sending to a person's own address and sending to their Company's
address remain two explicit, separately labelled choices. Sapling does not use
the Company address as an invisible fallback for a Person without an email
address.

The neighboring **Phone Calls** tab uses the same pattern for `PhoneCallItem`,
filtering by `entity` and `reference`. When the current record contains a field
marked `isPhone`, the existing phone-call dialog can be opened directly from the
tab with that number and the current record context. The tab is omitted when no
populated `isPhone` field exists. Non-persistent named-assistant fields such as
projected ticket contact mail/phone values participate through the same metadata
options.

Automatic email subscriptions are executed by the generic create/update flow
after a record was saved. A rule without conditions always sends when its
lifecycle trigger matches, which is useful for create confirmations. Rules with
conditions require every configured condition to match. On updates, each
condition also requires the observed field to have changed. For example, a
ticket rule can require both `solutionDescription` to change and `status` to
change to `closed`. Custom fields are available as `customFields.<fieldKey>`;
their configured labels and select options are used by the condition editor,
and their hydrated old/new values participate in update matching.

For automatic shared-mailbox delivery, `senderPerson` remains the OAuth
authentication identity and `senderMailbox` supplies the visible From address.
The mailbox must be active, use the same provider, and belong to an active
shared-mailbox group assigned to the sender person. Sender resolution applies
the same allow-list validation as manual delivery. Existing subscriptions
without `senderMailbox` continue to send from the sender person's default
address.

## Sender Resolution

Sender options are resolved from the current person:

1. Active user provider from `PersonItem.type`.
2. OAuth session tokens from `PersonSessionItem`.
3. Provider-discovered primary or alias addresses.
4. Configured shared mailboxes assigned through active mailbox groups.
5. Fallback to the user's profile email when provider lookup is not available.

The optional `entityHandle` query parameter on `GET /api/mail/senders` resolves
an active `SharedMailboxContextItem`. Each context entity can have at most one
configured default mailbox and one optional default email template, while the
same mailbox can be reused for any number of contexts. The template selection is
restricted to email templates for the configured entity and is applied only
while the selected template is active. The configured mailbox replaces the
provider default only when it is active, belongs to an active group assigned to
the current person, and uses the current provider. Otherwise sender resolution
keeps the normal personal or provider default. The mail composer passes its
current entity context when it loads sender options, so opening it from a ticket
or another configured entity preselects the eligible shared address and
configured email template without preventing a manual change.

## Context Recipient Suggestions

The manual mail composer derives optional recipient suggestions from entity
metadata. Every readable context field marked with `isCompany` participates;
the field does not also need `isCustomer`. A Company record itself participates
through its `isCompany` primary key. For persisted contexts the composer loads
missing company references with a narrow projection, while draft values take
precedence so unsaved company changes are respected.

The current user's Company is added to the resolved context companies. Company
handles are deduplicated before loading contacts, so a Company that is both the
user's own Company and part of the record context is queried only once.

When the current user can read Person records, active people with an email
address from all resolved companies are offered in the **To**, **CC**, and
**BCC** comboboxes. The dropdown groups entries by Company, places the current
user's Company first, and separates subsequent Company groups visually. The
current Company header is marked explicitly. Companies and the people within
each Company are sorted alphabetically. Entries are shown as:

```text
Ada Lovelace (Acme GmbH, Entwicklung) – ada@example.com
```

Missing company or department labels use an em dash so both context positions
remain visible. Selecting a suggestion stores and displays only its email
address. Free-form email entry, delimiter handling, CC, and BCC behavior remain
unchanged. Duplicate email addresses are collapsed case-insensitively.

When a sender email is requested explicitly, it must match an available sender option. Otherwise `mail.senderNotAllowed` is raised.

Azure shared-mailbox sending additionally requires delegated
`Mail.Send.Shared` in `AZURE_AD_SCOPE` and Exchange `Send As` permission from
the selected mailbox to the authentication user. After either permission or
the configured OAuth scopes change, the user must sign in again so the stored
session contains the new grant. Google sender mailboxes must be configured as
send-as aliases for the authenticated Google account.

## Teams Model

`TeamsTemplateItem` stores reusable Teams message markdown.

`TeamsSubscriptionItem` decides when a Teams message is created.

| Field            | Meaning                                    |
| ---------------- | ------------------------------------------ |
| `description`    | Human-readable subscription name           |
| `recipientField` | Context path resolving a recipient person  |
| `isActive`       | Enables/disables the subscription          |
| `entity`         | Entity being observed                      |
| `type`           | Lifecycle event, for example `afterInsert` |
| `template`       | Entity-dependent Teams template            |

`TeamsDeliveryItem` stores one outgoing Teams message.

| Field                                | Meaning                    |
| ------------------------------------ | -------------------------- |
| `status`                             | Pending, success, failed   |
| `subscription`, `template`, `entity` | Source configuration       |
| `createdBy`                          | Sender                     |
| `recipientPerson`                    | Resolved recipient         |
| `referenceHandle`                    | Source record handle       |
| `provider`                           | Currently `azure`          |
| `bodyMarkdown`, `bodyHtml`           | Rendered content           |
| `requestPayload`                     | Audit/debug payload        |
| `responseStatusCode`, `responseBody` | Provider result            |
| `providerMessageId`                  | Microsoft Graph message id |

## Teams Flow

Teams messages are usually triggered by server scripts. `ScriptService.runSubscription()` loads active `TeamsSubscriptionItem` rows matching the entity and lifecycle type, resolves recipient relations, and calls `TeamsService.querySubscription()`.

`TeamsService` then:

The service now owns subscription/template preparation and delivery queueing.
`TeamsGraphDeliveryService` owns Graph chat/message transport, Azure access
token refresh, authentication retry, and delivery status persistence.

1. Loads the subscription, entity, type, and template.
2. Builds message context for each payload item.
3. Resolves `recipientField` to a `PersonItem`.
4. Renders markdown and HTML.
5. Persists a delivery as pending or failed.
6. Queues `deliver-teams-message` when Redis is enabled or dispatches immediately otherwise.
7. Sends through Microsoft Graph using the current user's Azure session.

Teams delivery requires:

- sender has provider type `azure`
- sender has a usable Azure session/access token or refresh token
- recipient has provider type `azure`
- recipient has a `loginName`

Self messages use the Microsoft Teams self-chat id `48:notes`; other messages use a one-on-one chat.

## Extension Checklist

When adding a new mail template:

1. Add a new numbered seed file in the right `emailTemplate` folder.
2. Set `entity` to the entity whose record supplies placeholders.
3. Keep subject short and body markdown readable without HTML.
4. Use `{{currentUser...}}` and entity paths intentionally.
5. Preview in the UI before relying on send behavior.

The manual composer builds its placeholder catalog from the readable fields of
the current entity. Nested relation placeholders are included only when the
current user may read the referenced entity. Missing access to an optional
relation, email-template catalog, contact catalog, or document catalog must not
fail the composer or trigger a forbidden request; the corresponding optional
choices are simply omitted. Sending still requires update access to the context
entity. Preview rendering is read-only and remains available during
impersonation, while the send action is hidden and remains blocked server-side.

When adding a new automatic email subscription:

1. Reuse an active `EmailTemplateItem` for the target entity.
2. Add an `EmailSubscriptionItem` with `entity`, `type`, `recipientField`, `senderPerson`, and `template`.
3. Choose a sender person with an Azure or Google person type and a usable provider session.
4. To send from a shared address, select an optional `senderMailbox` assigned to that sender person and provider.
5. Add zero or more conditions. Zero conditions means the rule always sends for the matching trigger.
6. For update notifications, each condition observes one field; optionally set `oldValue` and/or `newValue`.
7. Use relation handles for value constraints, for example `closed` for a status handle.
8. Make sure the recipient path resolves to a person with an email address or directly to an email string.

When configuring a manual context default:

1. Create or reuse an active shared mailbox in an active mailbox group.
2. Assign the group to every person who may use that sender.
3. Create one `sharedMailboxContext` record for each desired entity context,
   such as `ticket`, and select the mailbox plus an optional email template.
4. Reuse the same mailbox in additional context records when it should be the
   default in several entities.
5. Confirm the provider-specific Send As permission and OAuth scopes.

When adding a new Teams subscription:

1. Add or reuse a `TeamsTemplateItem` for the entity.
2. Add a `TeamsSubscriptionItem` with `entity`, lifecycle `type`, `recipientField`, and `template`.
3. Make sure the recipient path can resolve to a person handle or person object.
4. Confirm server lifecycle hooks run for the entity operation.
5. Verify sender and recipient Azure prerequisites.

## Verification

Useful targeted commands:

```powershell
npm test --prefix backend -- mail.service.spec.ts teams.service.spec.ts --runInBand
npm test --prefix backend -- email-inbox-sync.service.spec.ts email-inbox-provider.service.spec.ts --runInBand
npm test --prefix backend -- TeamsDeliveryController.spec.ts EmailDeliveryController.spec.ts --runInBand
npm run type-check:backend
npm run type-check:frontend
.\node_modules\.bin\vitest.cmd run src\components\dialog\mail\SaplingDialogMailComposer.spec.ts
.\node_modules\.bin\vitest.cmd run src\components\dialog\fields\__tests__\SaplingFieldTeamsRecipient.test.ts
```

Run provider-specific manual checks for real Azure/Google/Teams dispatch because local tests should not depend on external provider availability.
