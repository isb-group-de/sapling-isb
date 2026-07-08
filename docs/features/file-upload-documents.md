# File Upload And Document Handling

Sapling documents are generic attachments linked to any entity record through an entity handle and a record reference. The database stores document metadata; the binary content is stored on disk under the backend storage directory.

## Main Files

```text
backend/src/entity/DocumentItem.ts
backend/src/entity/DocumentTypeItem.ts
backend/src/api/document/document.controller.ts
backend/src/api/document/document.service.ts
backend/src/api/document/dvelop-document.service.ts
frontend/src/components/actions/SaplingActionUpload.vue
frontend/src/components/file/
frontend/src/components/dialog/mail/
frontend/src/composables/dialog/useSaplingDialogMailEditor.ts
```

Seed files:

```text
backend/src/database/seeder/json-production/documentType/
backend/src/database/seeder/json-demonstration/documentType/
```

## Data Model

`DocumentItem` stores metadata for one uploaded file.

| Field         | Meaning                                   |
| ------------- | ----------------------------------------- |
| `handle`      | Document id                               |
| `path`        | Internal storage filename; generated UUID |
| `filename`    | Original uploaded filename                |
| `mimetype`    | Uploaded MIME type                        |
| `length`      | File size in bytes                        |
| `description` | Optional user description                 |
| `reference`   | Target record handle stored as string     |
| `entity`      | Target `EntityItem`                       |
| `type`        | `DocumentTypeItem` classification         |
| `person`      | Uploading person                          |

`reference` uses `@SaplingGenericReference({ entityField: 'entity', handleField: 'reference' })`, so it can point to different entity types without a concrete foreign key.

`DocumentTypeItem` is reference data for classifying documents. Use stable handles such as `document`, `offer`, or `contract` rather than changing them after seed data is in use.

## d.velop Cloud Overlay

The local `DocumentItem` storage path remains the default and is intentionally unchanged.

Sapling can optionally configure a d.velop Cloud overlay through:

- `DvelopConnectionItem`: one d.velop Cloud instance with base URL, API key, selected repository, default category, and active flag.
- `DvelopRepositoryItem`: synchronized d.velop Cloud repositories for a connection.
- `DvelopObjectDefinitionItem`: synchronized d.velop Cloud categories for a connection.
- `DvelopPropertyItem`: synchronized d.velop Cloud properties for a connection.
- `DvelopEntityMappingItem`: per-entity mapping from Sapling records to d.velop Cloud categories.
- `DvelopEntityMappingSearchCategoryItem`: categories used when searching linked d.velop Cloud documents.
- `DvelopEntityMappingPropertyItem`: Sapling source fields or static values mapped to d.velop Cloud properties.

The `/dvelop-cloud` configuration page asks the Sapling backend to load repositories, categories, and properties from d.velop Cloud with the configured connection API key, then imports them into Sapling so users can select repository, categories, and properties instead of typing d.velop IDs manually.

When an active d.velop Cloud connection and active mapping exist for the current entity, document actions are resolved before the local UI opens:

- Show documents calls `GET /api/document/dvelop/open/:entityHandle/:reference` and opens the returned d.velop Cloud search-results dialog URL.
- Upload document calls `GET /api/document/dvelop/upload-dialog/:entityHandle/:reference` and opens the returned d.velop Cloud storage dialog URL.

If no active d.velop Cloud mapping is configured, the frontend falls back to the existing local behavior:

- Show documents opens `/file/document?filter=...`.
- Upload document opens the existing Sapling upload dialog and stores a local `DocumentItem`.

This means d.velop Cloud is an overlay, not a replacement for the stored local document model.

## Storage

Uploads are stored under:

```text
backend/storage/<entityHandle>/<uuid>
```

Only the UUID is persisted in `DocumentItem.path`. The original filename is kept separately in `DocumentItem.filename` and is used for download/preview response headers.

The current implementation writes files with `fs.writeFileSync()` and creates the entity-specific storage folder when needed.

## API Contract

All document endpoints require `SessionOrBearerAuthGuard`.

| Endpoint                                                          | Permission                                  | Purpose                                                       |
| ----------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `POST /api/document/upload/:entityHandle/:reference`              | `allowUpdate` on `entityHandle`             | Uploads and links a file                                      |
| `GET /api/document/dvelop/open/:entityHandle/:reference`          | `allowRead` on `entityHandle`               | Resolves a d.velop Cloud document-results URL when configured |
| `GET /api/document/dvelop/upload-dialog/:entityHandle/:reference` | `allowUpdate` on `entityHandle`             | Resolves a d.velop Cloud storage dialog URL when configured   |
| `POST /api/document/dvelop/config/:connectionHandle/import`       | `allowUpdate` on `dvelopConnection`         | Imports normalized d.velop Cloud repositories, categories, and properties |
| `GET /api/document/download/:handle`                              | `allowRead` on the document's target entity | Downloads original file as attachment                         |
| `GET /api/document/preview/:handle`                               | `allowRead` on the document's target entity | Previews PDFs inline, other files as attachment               |

Upload expects multipart form data:

| Field         | Meaning              |
| ------------- | -------------------- |
| `file`        | Binary file          |
| `typeHandle`  | Document type handle |
| `description` | Optional description |

Download and preview resolve the document first, then derive permission from `document.entity.handle` through `GenericPermissionGuard`.

## Mail Attachments

Mail composer attachment selection loads `DocumentItem` rows for the current entity/reference and sends selected document handles as `attachmentHandles`.

During mail dispatch, `MailService` loads the corresponding files and embeds them in the provider-specific message:

- Azure Graph message attachments are base64 encoded.
- Google sends a MIME message with multipart attachments.

This means attachment handles are metadata references; the actual binary file must still exist under storage at send time.

## Extension Checklist

When adding a new document type:

1. Add `documentTypeData_XXX.json` seed files in production and demonstration if needed.
2. Add translations for the document type.
3. Confirm permissions for `document` and `documentType`.
4. Verify upload, preview, download, and mail attachment selection.

When changing storage behavior:

1. Keep `DocumentItem.path` opaque and never expose storage paths to users.
2. Preserve download/preview permission resolution through the target entity.
3. Update mail attachment loading if the binary storage path changes.
4. Add migration only if metadata fields change.
5. Add cleanup/migration tooling if existing files must move.

When changing d.velop Cloud overlay behavior:

1. Do not route existing local uploads through d.velop Cloud automatically; d.velop Cloud upload is a browser dialog URL.
2. Preserve local fallback when no active d.velop Cloud connection or entity mapping exists.
3. Keep d.velop Cloud configuration in dedicated d.velop entities rather than adding fields to `DocumentItem`.
4. Use the official d.velop dialog URL parameters documented for DMSApp.

## Verification

Useful commands:

```powershell
npm run type-check:backend
npm run type-check:frontend
npm test --prefix backend -- generic-permission.guard.spec.ts --runInBand
```

For UI changes, manually verify upload from a table context menu, preview a PDF, download a non-PDF file, and send an email with an attached document in a test environment.
