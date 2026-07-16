import { ENTITY_REGISTRY } from '../entity/global/entity.registry';
import { buildRootEntityExample } from './generic-entity-swagger.examples';
import {
  patchEntityCreateOperation,
  patchEntityDownloadOperation,
  patchEntityListOperation,
  patchEntityUpdateOperation,
} from './generic-entity-swagger.operations';
import type {
  EntityRegistryEntry,
  EntitySchemaVariant,
  SwaggerDocument,
} from './generic-entity-swagger.types';

export { buildGenericEntitySwaggerUiScript } from './generic-entity-swagger-ui';

const GENERIC_ENTITY_COLLECTION_PATH = '/api/generic/{entityHandle}';
const GENERIC_ENTITY_DOWNLOAD_PATH = '/api/generic/{entityHandle}/download';

export function enhanceGenericEntitySwaggerDocument(
  document: SwaggerDocument,
): SwaggerDocument {
  const schemas = document.components?.schemas;
  if (!schemas) {
    return document;
  }

  const entityVariants: EntitySchemaVariant[] = [];
  const entityRegistry = ENTITY_REGISTRY as EntityRegistryEntry[];

  for (const entry of entityRegistry) {
    const schemaName = entry.class.name;
    if (!schemas[schemaName]) {
      continue;
    }

    entityVariants.push({
      handle: entry.name,
      requestExample: buildRootEntityExample(schemaName, schemas, 'request'),
      responseExample: buildRootEntityExample(schemaName, schemas, 'response'),
    });
  }

  if (entityVariants.length === 0) {
    return document;
  }

  const collectionPath = document.paths?.[GENERIC_ENTITY_COLLECTION_PATH];
  const downloadPath = document.paths?.[GENERIC_ENTITY_DOWNLOAD_PATH];

  if (collectionPath) {
    patchEntityListOperation(collectionPath.get, entityVariants);
    patchEntityCreateOperation(collectionPath.post, entityVariants);
    patchEntityUpdateOperation(collectionPath.patch, entityVariants);
  }

  if (downloadPath) {
    patchEntityDownloadOperation(downloadPath.get, entityVariants);
  }

  return document;
}
