# d.velop Cloud Document Integration

Sapling supports d.velop Cloud as a document overlay. The existing local `DocumentItem` model and file storage stay intact; d.velop Cloud is only used when an active d.velop connection and an active mapping exist for the current entity.

The d.velop Cloud configuration pages live in the navigation under `Wissenspool > d.velop Cloud`, separate from the local `Dokumente` group.

Official references:

- [d.velop DMSApp OpenAPI](https://help.d-velop.de/dev/api/openapi/dms-app)
- [d.velop DMS configuration OpenAPI](https://help.d-velop.de/dev/api/openapi/dmsconfig)

## Data Model

`DvelopConnectionItem` configures one d.velop Cloud instance:

| Field                     | Meaning                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `handle`                  | Generated internal ID for the connection                                             |
| `title`                   | Admin-facing title                                                                   |
| `baseUrl`                 | d.velop Cloud base URL, for example `https://tenant.d-velop.cloud`                   |
| `apiKey`                  | d.velop Cloud API key used server-side for metadata synchronization                  |
| `repository`              | Selected `DvelopRepositoryItem`; synchronized from the configured d.velop Cloud      |
| `defaultObjectDefinition` | Optional default d.velop category for storage, selected from synchronized categories |
| `isActive`                | Enables the overlay                                                                  |

`DvelopRepositoryItem` stores synchronized d.velop Cloud repositories for one connection. A connection only needs `baseUrl` and `apiKey` for the first repository synchronization; after that, admins select the repository from the relation field.

`DvelopObjectDefinitionItem` stores synchronized d.velop Cloud categories for one connection. Sapling keeps the d.velop category key in `dvelopId` and uses the record relation wherever a category must be selected.

`DvelopPropertyItem` stores synchronized d.velop Cloud properties for one connection and, when known, one d.velop storage category. Sapling keeps the d.velop property key in `dvelopId` and uses it for search and storage dialog prefill values. Category-specific properties must match the storage category selected on the entity mapping; global properties without a category remain usable as fallback fields.

`DvelopEntityMappingItem` maps a Sapling entity to d.velop Cloud:

| Field              | Meaning                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `connection`       | Active d.velop connection                                                                      |
| `entity`           | Sapling entity whose document actions should use d.velop Cloud                                 |
| `objectDefinition` | Optional storage category for this entity                                                      |
| `searchCategories` | Related `DvelopEntityMappingSearchCategoryItem` records used for search results                |
| `propertyMappings` | Related `DvelopEntityMappingPropertyItem` records mapping Sapling fields to d.velop properties |
| `isActive`         | Enables this entity mapping                                                                    |

Use `sourceField` on a property mapping for a Sapling record path, for example `handle`. Use `staticValue` when a fixed d.velop value should always be sent.

Property mappings can be bootstrapped from a saved `DvelopEntityMappingItem`
with the script button "Eigenschaftszuordnung mit AI erstellen". The button
opens Songbird with the current mapping as context. Songbird loads the mapping,
the Sapling entity schema, synchronized d.velop properties, and existing
property mappings, then prepares `DvelopEntityMappingPropertyItem` creates or
updates through the normal generic tools. Mutations remain subject to the
configured AI agent confirmation mode and generic permissions.

The custom d.velop Cloud configuration page (`/dvelop-cloud`) asks the Sapling backend to load repositories, categories, and properties from the configured d.velop Cloud instance. Sapling sends the configured API key as an `Authorization: Bearer ...` header, normalizes the returned metadata, and stores it in the dedicated d.velop entities.

Repository synchronization reads `/dms/r`. For category synchronization Sapling first reads d.velop object definitions from `/dms/r/{repositoryId}/objdef` and falls back to `/dmsconfig/r/{repositoryId}/objectmanagement/categories/` plus older configuration endpoint variants. Properties are primarily derived from the object definition `propertyFields`; if a category does not include those fields, Sapling loads the category detail from `/dmsconfig/r/{repositoryId}/objectmanagement/categories/{categoryId}` and extracts the embedded properties. In both cases Sapling stores the originating category on the property record so mapping and upload prefill cannot accidentally send fields from a different d.velop category.

The sync endpoint automatically includes prerequisites for explicit sync actions:

- `repositories`: loads only repositories and selects the default/first repository when none is configured yet.
- `objectDefinitions`: loads repositories first when the connection has no repository, then loads categories.
- `properties`: loads repositories when needed, always refreshes categories, then loads properties.

The d.velop Cloud workspace also exposes a healthcheck for the configured API key. It does not persist metadata. Instead, it executes the same capability checks Sapling needs at runtime: local API key/base URL validation, repository access, category/object definition access, and property access. The result is reported per capability with success, warning, or error status.

## Runtime Flow

The frontend never switches directly to d.velop Cloud by hard-coded client logic. It asks the backend first:

| Action          | Endpoint                                                          | Active d.velop Cloud result        | No active d.velop Cloud result    |
| --------------- | ----------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| Show documents  | `GET /api/document/dvelop/open/:entityHandle/:reference`          | Opens d.velop Cloud search results | Opens local `/file/document` view |
| Upload document | `GET /api/document/dvelop/upload-dialog/:entityHandle/:reference` | Opens d.velop Cloud storage dialog | Opens local Sapling upload dialog |

The browser user session is responsible for d.velop Cloud authentication. Sapling does not upload the selected binary file to d.velop Cloud in this flow; it opens the official d.velop Cloud storage dialog with prefilled properties.

d.velop exposes some system-like properties through metadata that are not accepted by the storage dialog as URL prefill properties. Sapling keeps those properties synchronized for transparency, but excludes `property_caption` and `property_remark` from storage dialog prefill values.

## d.velop Cloud Dialog URLs

Sapling builds URLs under the configured `baseUrl`:

- Show documents: `/dms/r/{repositoryId}/sr`
- Upload document: `/dms/new`

Search result properties are sent as arrays in the `properties` JSON query parameter:

```json
{
  "property_document_number": ["12345"]
}
```

Storage dialog properties are sent as string values in the `properties` JSON query parameter:

```json
{
  "property_document_number": "12345"
}
```

If search categories are configured, Sapling sends them as the d.velop Cloud `objectdefinitionids` JSON array. Otherwise it uses the entity mapping storage category when present.

## Extension Rules

Keep the overlay separate from local documents:

1. Do not add d.velop Cloud fields to `DocumentItem`.
2. Do not change `DocumentService.uploadDocument()` for d.velop Cloud.
3. Add new d.velop Cloud features under the dedicated d.velop entities and service.
4. Preserve local fallback whenever d.velop Cloud is not configured or inactive.
