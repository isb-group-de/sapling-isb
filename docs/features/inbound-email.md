# Inbound Email Synchronization And AI Processing

Sapling can poll Azure and Google inboxes, persist each incoming message as CRM
activity, preserve the complete RFC 822 source as a document, and hand the
message to a configured Songbird agent. The agent may create or update exactly
one support ticket, sales opportunity, or office task under the permissions of
the configured executing user.

## Main Files

```text
backend/src/entity/EmailInboxSubscriptionItem.ts
backend/src/entity/InboundEmailItem.ts
backend/src/entity/InboundEmailStatusItem.ts
backend/src/api/mail/email-inbox-provider.service.ts
backend/src/api/mail/email-inbox-sync.service.ts
backend/src/api/mail/email-inbox-processing.service.ts
backend/src/api/mail/email-inbox-sync.utils.ts
backend/src/api/mail/email-inbox-sync.processor.ts
backend/src/api/mail/email-inbox-sync.controller.ts
```

`EmailInboxSyncService` owns scheduling, provider import, idempotent
persistence, source-document storage, and manual retry orchestration.
`EmailInboxProcessingService` owns the AI lifecycle and confirm-first mutation
flow. Shared prompt, customer-binding, status, logging, and target-linking rules
live in `email-inbox-sync.utils.ts`; callers continue to use the stable sync
service facade.

## Configuration Model

Create an `emailInboxSubscription` in the generic table UI. Each subscription
selects:

- a `SharedMailboxItem` inbox
- an Azure or Google `processingPerson` whose existing OAuth session is used
- processing mode `ticket`, `salesOpportunity`, or `officeTask`
- an optional active `AiAgentItem`
- mailbox-specific context markdown
- polling interval, normally one minute
- whether AI actions are automatically confirmed
- whether the first run imports the previous 24 hours or starts from activation

Sapling ships target-specific agent defaults for this workflow:

- `ticketSupportAgent` for support tickets
- `salesOpportunityAgent` for sales opportunities
- `officeTaskAgent` for office tasks/events

The mailbox prompt still enforces the selected processing target independently
of the chosen agent.

For a mailbox different from the executing person's own address, the person
must belong to the active `SharedMailboxGroupItem` assigned to the mailbox.
The provider on the mailbox and person must match.

## Provider Authentication

No inbound-mail credentials are stored separately. The provider adapter calls
the same `MailService` OAuth-session and refresh-token path used by outgoing
mail.

- Azure uses Microsoft Graph delegated `Mail.Read`; shared mailboxes also need
  `Mail.Read.Shared`.
- Google uses delegated Gmail `gmail.readonly`. The API operates as `me` and
  narrows aliases or group-delivered mail with `deliveredto:`.

After adding scopes, users must sign in again so the provider grants them.
Azure tenant consent may also be required.

## Import And Idempotency

The scheduler checks active subscriptions once per minute and queues due
imports. Polls overlap by five minutes so delayed provider results are not
missed. Only one automatic import job per subscription may be active, waiting,
or delayed at a time. A database uniqueness constraint on mailbox plus provider
message ID makes poll overlap, provider retries, and manual runs idempotent.

For every new message Sapling:

1. stores provider IDs, headers, sender, recipients, readable text/HTML, and
   received time in `InboundEmailItem`;
2. matches sender email case-insensitively to `PersonItem`, then its company,
   or directly to `CompanyItem`;
3. downloads the provider's complete message and creates a `DocumentItem` of
   type `email` with MIME type `message/rfc822`;
4. records every import and processing transition in `processingLog`;
5. queues AI processing when enabled.

The original `.eml` is the immutable source and contains the complete MIME
message, including attachments. Provider secrets and access tokens are never
written to the message or log.

Customer assignment is sender-driven. For new tickets, opportunities, and
office tasks, `creatorPerson` and `creatorCompany` are taken only from the
case-insensitive match of the RFC 822 `From` address. Recipients, the mailbox,
and the executing user must never become the customer. If the sender cannot be
resolved unambiguously to both a person and company, automatic creation stops
in manual review. Updates preserve the existing record's customer assignment.

## AI Safety And Linking

The email body is explicitly delimited as untrusted data in the agent prompt.
It cannot change the automation policy. Read/search tools remain available,
but automatic confirmation accepts only one pending `generic_create` or
`generic_update` action for the configured target entity:

| Mode               | Allowed target     |
| ------------------ | ------------------ |
| `ticket`           | `ticket`           |
| `salesOpportunity` | `salesOpportunity` |
| `officeTask`       | `event`            |

Normal agent scopes, entity permissions, security filters, and the executing
user's permissions still apply. Delete actions, unrelated entities, multiple
actions, and failed actions are not automatically executed. When an agent
finishes with prose but no mutation, the workflow sends exactly one corrective
request in the same AI session. Only if that bounded repair still yields no
action does the email enter manual review. The inbound message links to the
created or updated record, so it participates in record-centric CRM timelines.

Before creating a record, the agent checks the subject before the body for an
exact ticket number/external number, office-task reference or event handle, or
sales-opportunity number. An exact match must be updated instead of creating a
duplicate. Sales opportunities use their own prefixed number range
(`SO-YYYY-00001`), generated from the independent opportunity handle sequence.
This keeps them visibly distinct from ticket numbers and follows the existing
prefixed internal-case pattern (`IC-YYYY-00001`).

Entity schemas distinguish database non-nullability from caller input. A field
with an ORM or database default is returned to AI tools with `nullable=false`,
its `default`/`defaultRaw` metadata, and `isRequired=false`; it therefore does
not appear in `requiredFieldNames`. For new tickets this applies to
`status=open`, `priority=normal`, `type=incident`, and `source=email`. The
inbound workflow also fills these four missing values immediately before
confirmation as a deterministic safety net, without replacing valid values
chosen by the agent.

## Status And Manual Recovery

`InboundEmailStatusItem` provides:

- `pending`
- `processing`
- `processed`
- `manualReview`
- `failed`

Missing agents, disabled automatic processing, ambiguous agent results, and
permission failures are visible in `processingMessage` and `processingLog`.
AI-provider authorization failures are logged separately as
`ai.providerAuthorizationFailed`; the message points administrators to the
configured credential, project membership, Chat Completions write permission,
and model access without exposing the secret itself.
An AI/provider failure is persisted once as `failed` and is not retried in an
unbounded background loop. It remains visible for manual review until an
administrator explicitly reprocesses it; that request receives a fresh queue
job and is logged on the inbound message.
Administrators can trigger immediate polling or retry one message:

```text
POST /api/email-inbox/subscriptions/:handle/synchronize
POST /api/email-inbox/messages/:handle/reprocess
```

The subscription table also exposes **Fetch mailbox now** in its record action
menu. A manual fetch runs exactly once even when automatic polling is disabled;
the scheduler continues to ignore disabled subscriptions.

The same reprocessing operation is available as **Retry Processing** in an
inbound email record's dynamic action menu. Viewing linked documents is also
available for the read-only inbound-email entity; uploading additional
documents remains governed by insert permission.

## Operations

Automatic scheduling uses BullMQ queue `email-inbox-sync` and therefore needs
`REDIS_ENABLED=true`. With Redis disabled, the two administrative endpoints run
synchronously, but no recurring poll is registered.

Monitor:

- subscription `lastRunAt`, `lastSuccessAt`, `lastError`, and counters
- inbound messages in `manualReview` or `failed`
- BullMQ failures and backend logs
- storage capacity for `.eml` documents
- OAuth reauthentication errors after scope or tenant-policy changes

## Verification

```powershell
npm test --prefix backend -- email-inbox-sync.service.spec.ts email-inbox-processing.service.spec.ts email-inbox-sync.utils.spec.ts email-inbox-provider.service.spec.ts --runInBand
npm run type-check:backend
npm run type-check:frontend
```

Real provider smoke tests require a consented Azure or Google test account and
must verify personal/shared mailbox access, document download, CRM matching,
and one end-to-end agent action.
