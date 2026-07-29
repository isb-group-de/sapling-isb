# Authentication, Sessions, And Providers

Sapling supports session authentication for the browser, bearer-token authentication for API consumers, local username/password login, Azure and Google OAuth login, provider sessions for external integrations, and administrator impersonation.

## Main Files

```text
backend/src/auth/auth.controller.ts
backend/src/auth/auth-administration.controller.ts
backend/src/auth/auth.service.ts
backend/src/auth/auth-passkey.service.ts
backend/src/auth/auth-provider-user-import.service.ts
backend/src/auth/auth-provider-directory.service.ts
backend/src/auth/local/local.strategy.ts
backend/src/auth/azure/azure.strategy.ts
backend/src/auth/google/google.strategy.ts
backend/src/auth/guard/session-or-token-auth.guard.ts
backend/src/auth/guard/generic-permission.guard.ts
backend/src/auth/guard/admin-permission.guard.ts
backend/src/session/session.serializer.ts
backend/src/session/session.config.ts
backend/src/entity/PersonItem.ts
backend/src/entity/PersonPasskeyItem.ts
backend/src/entity/PersonSessionItem.ts
backend/src/entity/PersonApiTokenItem.ts
frontend/src/stores/authStore.ts
frontend/src/stores/currentPersonStore.ts
frontend/src/router/index.ts
frontend/src/components/account/SaplingLogin.vue
```

## Authentication Modes

| Mode                  | Purpose                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Local session         | Browser login with username/password                                                         |
| Local passkey step-up | Browser WebAuthn/passkey challenge after a valid local password when passkeys are registered |
| Azure session         | Browser OAuth login and provider tokens for Microsoft Graph                                  |
| Google session        | Browser OAuth login and provider tokens for Google APIs                                      |
| Bearer API token      | API access for automations, MCP, and integrations                                            |
| Impersonation         | Administrator "view as user" support                                                         |

Most protected backend endpoints use `SessionOrBearerAuthGuard`, so the same endpoint can work for browser sessions and API clients.

## Session Login

Local login:

```text
POST /api/auth/local/login
```

Azure login:

```text
GET /api/auth/azure/login
GET /api/auth/azure/callback
```

Google login:

```text
GET /api/auth/google/login
GET /api/auth/google/callback
```

Provider user import for administrators:

```text
GET /api/auth/provider-users?provider=azure|google&search=&pageToken=
POST /api/auth/provider-users/import
```

Logout:

```text
POST /api/auth/logout
```

Auth check:

```text
GET /api/auth/isAuthenticated
```

`AuthController.completeLogin()` regenerates the session before logging in the user. Local login sets session max age based on `rememberMe`.

`SESSION_COOKIE_SECURE=true` always enables the Secure cookie flag, while
`SESSION_COOKIE_SECURE=false` explicitly disables it for HTTP-based local test
systems, including runs with `NODE_ENV=production`. When the setting is omitted
or invalid, Sapling defaults it to `true` in production and `false` otherwise.
Production deployments served over HTTPS should set it to `true`.

Role-based starter dashboards and favorites are provisioned during successful
login and when the explicit current-person profile is loaded. Session
deserialization deliberately skips this provisioning so ordinary API requests
only reload the user relations required for authorization.

Local passkeys:

```text
GET /api/auth/passkey
POST /api/auth/passkey/register/options
POST /api/auth/passkey/register/verify
DELETE /api/auth/passkey/:handle
POST /api/auth/local/passkey/verify
```

Passkeys apply only to Sapling's local username/password login. Azure and Google OAuth continue to rely on their provider-side authentication and MFA policies.

When a local user has at least one registered `PersonPasskeyItem`, `POST /api/auth/local/login` validates the password but does not establish the session immediately. It stores a short-lived WebAuthn challenge in the browser session and returns authentication options. The frontend calls `navigator.credentials.get` through `@simplewebauthn/browser`, then posts the assertion to `/api/auth/local/passkey/verify`. Only after successful verification does the backend call `completeLogin()`.

If a user loses all passkeys, an administrator can delete the user's `personPasskey` records. With no registered passkeys remaining, the account falls back to normal local password login.

## Person And Provider Sessions

`PersonItem` contains the core account fields:

- `loginName`
- `loginPassword`
- `requirePasswordChange`
- `isActive`
- `type`
- roles and permissions
- optional `session`
- related `passkeys`

`PersonSessionItem` stores provider access and refresh tokens for Azure/Google integrations. Outgoing and incoming mail, Teams, and calendar services use these tokens for provider APIs and refresh them when possible.

`PersonPasskeyItem` stores WebAuthn credentials for local logins:

- `credentialId`
- `publicKey`
- `counter`
- optional `transports`
- `credentialDeviceType` and `credentialBackedUp`
- `lastUsedAt`

Credential IDs and public keys are marked as security fields and are stripped from generic API responses.

`AuthService.saveNewLogin()` creates or updates the person and session after Azure/Google OAuth login:

1. Find person by provider profile handle/login name.
2. Create person if missing and a matching `PersonTypeItem` exists.
3. Create or update `PersonSessionItem` with access and refresh tokens.
4. Return the current-user profile.

Administrator provider import uses the current administrator's own Azure or Google session to read the provider directory. It creates or updates `PersonItem` records without storing provider tokens for imported people. The imported person's `loginName` is the external provider user ID, so a later OAuth login links back to the same Sapling person. Existing people are matched by provider ID first and email second; selected roles are added without removing existing roles. When a company is selected in the import dialog, Sapling assigns it to created people and updates existing imported people to that company.

Provider import responsibilities are separated: `AuthProviderDirectoryService`
owns Azure/Google directory paging, local search, provider mapping, access-token
refresh, and transient retry handling. `AuthProviderUserImportService` validates
the selected roles/company/person type and owns Sapling person persistence.
Pure provider mapping and error classification live in
`auth-provider-directory.utils.ts`.

Provider directory requirements:

- Azure imports call Microsoft Graph `/users` and require directory-read scopes such as `User.ReadBasic.All` or `User.Read.All` in `AZURE_AD_SCOPE`.
- Loading the signed-in user's Outlook master categories calls Microsoft Graph `/me/outlook/masterCategories` and requires `MailboxSettings.Read` in `AZURE_AD_SCOPE`. Users whose existing token predates that scope must reconnect their Microsoft account.
- Google imports call Google Workspace Admin SDK Directory `users.list` with `customer=my_customer` and require a scope such as `https://www.googleapis.com/auth/admin.directory.user.readonly` in `GOOGLE_SCOPE`. The signed-in Google account must have enough Workspace directory permission.

Inbound mailbox requirements:

- Azure personal inboxes require delegated `Mail.Read`; shared mailboxes also
  require `Mail.Read.Shared` in `AZURE_AD_SCOPE`.
- Google inboxes require
  `https://www.googleapis.com/auth/gmail.readonly` in `GOOGLE_SCOPE`.
- Existing sessions do not gain newly configured scopes automatically. The
  executing user must sign in again, and Azure may require tenant consent.

## Bearer API Tokens

`PersonApiTokenItem` stores inbound API tokens.

| Field         | Meaning                                      |
| ------------- | -------------------------------------------- |
| `description` | Human-readable token label                   |
| `tokenPrefix` | Visible prefix for identification            |
| `rawToken`    | Non-persisted one-time secret before hashing |
| `tokenHash`   | Persisted SHA-256 hash with `sha256$` prefix |
| `isActive`    | Allows deactivation without deleting         |
| `expiresAt`   | Expiration timestamp                         |
| `lastUsedAt`  | Last successful use                          |
| `allowedIps`  | Optional exact-match IP allowlist            |
| `person`      | Token owner                                  |

Token endpoints:

| Endpoint                              | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| `GET /api/auth/token`                 | List token metadata                                |
| `POST /api/auth/token`                | Create token and return one-time secret            |
| `POST /api/auth/token/:handle/rotate` | Deactivate old token and return replacement secret |
| `DELETE /api/auth/token/:handle`      | Deactivate token                                   |

Managing another person's tokens requires global-stage permission on `personApiToken` for the requested action.

Bearer validation:

1. Hash incoming token.
2. Find active token with matching hash.
3. Reject expired tokens.
4. Load active owner as the request user.
5. Enforce `allowedIps` when configured.
6. Update `lastUsedAt` at most once per five-minute activity window to avoid a
   database write on every bearer-authenticated request.

## Session Or Bearer Guard

`SessionOrBearerAuthGuard` allows:

- public `GET /api/system/state`
- public generic reads for `translation`, `entity`, and `entityGroup`
- existing session user
- valid `Authorization: Bearer <token>` header

Invalid or missing credentials throw `UnauthorizedException`.

## Impersonation

Administrator impersonation is session-based.

Start:

```text
POST /api/auth/impersonate/:handle
```

Stop:

```text
POST /api/auth/impersonate/stop
```

Rules:

- only administrators can start impersonation
- nested impersonation is rejected
- users cannot impersonate themselves
- inactive targets are rejected
- the session keeps the real admin handle and adds `impersonatedHandle`
- `SessionSerializer` deserializes the target user only if the real user is still an administrator
- current user responses include `_impersonator` so the frontend can show the return action

The frontend hard-reloads after start/stop to rebuild stores, SSE connections, route guards, and cached permissions under the correct identity.

The database session store keeps session expiry sliding, but throttles expiry
updates while the persisted expiry is still fresh. This avoids a session-row
read and write on every authenticated request without changing the configured
session lifetime.

## Frontend Routing

The frontend router calls `authStore.validate()` before protected routes. It then loads the current person.

Routing outcomes:

| State                                | Route behavior             |
| ------------------------------------ | -------------------------- |
| unauthenticated                      | redirect to `login`        |
| authenticated without assigned roles | redirect to access pending |
| authenticated with roles             | allow app route            |

`currentPersonStore` owns current profile loading and impersonation start/stop actions.

## Security Notes

- Never expose `loginPassword`, token hashes, refresh tokens, or webhook secrets in APIs or webhook payloads.
- API token secrets are returned only once when created or rotated.
- Use short expirations and IP allowlists for automation tokens where possible.
- Provider refresh tokens are high-value secrets because they enable mail, Teams, and calendar actions.
- Bearer tokens act as the owning person and still go through generic permissions.

## Verification

Useful commands:

```powershell
npm test --prefix backend -- app-auth.controller.spec.ts session.serializer.spec.ts generic-permission.guard.spec.ts --runInBand
npm test --prefix backend -- encrypted-string.spec.ts request-origin-protection.spec.ts --runInBand
npm run type-check:backend
npm run type-check:frontend
```

Also verify login, local passkey registration/login/deletion, logout, token creation/rotation/deactivation, and impersonation in a browser against a test database.
