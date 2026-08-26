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

Upload MIME metadata is normalized per file. In particular, `.eml` is stored as
`message/rfc822` and `.msg` as `application/vnd.ms-outlook`, even when the
browser reports an empty or generic binary MIME type during a multi-file upload.
Multipart filenames that arrive as reversible UTF-8/Latin-1 mojibake are also
decoded before storage, so names containing umlauts remain intact after upload.

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

The generic record edit dialog also exposes a **Documents** tab. For local
storage it embeds the same filtered file table and preview workspace for the
current entity/reference and launches the existing upload dialog from the tab.
For an active d.velop Cloud mapping it keeps the overlay contract and presents
actions that open the cloud document and upload dialogs instead of exposing the
local document list.

This means d.velop Cloud is an overlay, not a replacement for the stored local document model.

## Storage

Uploads are stored under:

```text
backend/storage/<entityHandle>/<uuid>
```

Only the UUID is persisted in `DocumentItem.path`. The original filename is kept separately in `DocumentItem.filename` and is used for download/preview response headers.

The current implementation writes files with `fs.writeFileSync()` and creates the entity-specific storage folder when needed.

Administrators can inspect the real on-disk footprint in the system monitor.
`GET /api/system/document-storage` scans the local storage root recursively,
returns the total byte and file count, and groups the result by the top-level
entity folder. The system monitor presents the nine largest groups while the
summary API keeps the complete totals. Its detail dialog loads the complete
grouping on demand from `GET /api/system/document-storage/entities`. Symbolic
links and files placed directly in the storage root are not included in entity
totals.

## API Contract

All document endpoints require `SessionOrBearerAuthGuard`.

| Endpoint                                                          | Permission                                  | Purpose                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `POST /api/document/upload/:entityHandle/:reference`              | `allowUpdate` on `entityHandle`             | Uploads and links a file                                                  |
| `GET /api/document/dvelop/open/:entityHandle/:reference`          | `allowRead` on `entityHandle`               | Resolves a d.velop Cloud document-results URL when configured             |
| `GET /api/document/dvelop/upload-dialog/:entityHandle/:reference` | `allowUpdate` on `entityHandle`             | Resolves a d.velop Cloud storage dialog URL when configured               |
| `POST /api/document/dvelop/config/:connectionHandle/import`       | `allowUpdate` on `dvelopConnection`         | Imports normalized d.velop Cloud repositories, categories, and properties |
| `GET /api/document/download/:handle`                              | `allowRead` on the document's target entity | Downloads original file as attachment                                     |
| `GET /api/document/preview/:handle`                               | `allowRead` on the document's target entity | Previews PDFs inline, other files as attachment                           |

The frontend file browser also previews EML and Outlook MSG mail files. It
loads the protected download response with the current session, parses the mail
locally, sanitizes HTML, resolves embedded CID images, and exposes non-inline
mail attachments as download chips. Attachment bytes remain local to the
browser and retain their filename and MIME type when downloaded.

When an EML or Outlook MSG file is uploaded, the backend additionally extracts
each user-visible attachment as its own `DocumentItem` of type `document`. The
extracted files use the same entity/reference link and uploading person as the
original email, so they appear beside it in the existing document list and
automatically use the normal preview or download fallback. Inline EML parts and
MSG attachments marked as hidden remain only in the original mail file to avoid
filling the list with signature images. A malformed mail file does not prevent
the unchanged original file from being stored.

Upload expects multipart form data:

| Field         | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `file`        | Binary file                                               |
| `typeHandle`  | Document type handle                                      |
| `description` | Optional description; defaults to the normalized filename |

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

Deleting a `DocumentItem` through the generic API schedules deletion of its
opaque storage file only after the database delete succeeds. Bulk deletion uses
the same lifecycle for every selected document. Missing files are tolerated so
an already inconsistent record can still be removed; unsafe storage paths are
rejected instead of being resolved outside the document storage directory.

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

For UI changes, manually verify upload from a table context menu, preview a PDF,
preview both EML and MSG files, download an attachment from each mail preview,
download a non-PDF file, and send an email with an attached document in a test
environment.
