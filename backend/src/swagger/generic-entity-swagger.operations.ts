import { cloneExampleValue } from './generic-entity-swagger.examples';
import type {
  EntitySchemaVariant,
  SwaggerExample,
  SwaggerMediaType,
  SwaggerOperation,
  SwaggerSchema,
} from './generic-entity-swagger.types';

const JSON_CONTENT_TYPE = 'application/json';
const PAGINATION_META_SCHEMA_REF = '#/components/schemas/PaginationMetaDto';

export function patchEntityListOperation(
  operation: SwaggerOperation | undefined,
  entityVariants: EntitySchemaVariant[],
): void {
  if (!operation) {
    return;
  }

  const mediaType = ensureJsonResponse(operation, '200');
  mediaType.schema = {
    type: 'object',
    description:
      'Entity-specific list response. Nested references are collapsed to schema names in the examples.',
    properties: {
      data: {
        type: 'array',
        items: createGenericEntityResponseSchema(),
      },
      meta: {
        $ref: PAGINATION_META_SCHEMA_REF,
      },
    },
    required: ['data', 'meta'],
  };
  mediaType.examples = createPaginatedExamples(entityVariants);
}

export function patchEntityCreateOperation(
  operation: SwaggerOperation | undefined,
  entityVariants: EntitySchemaVariant[],
): void {
  if (!operation) {
    return;
  }

  const requestMediaType = ensureJsonRequest(operation);
  requestMediaType.schema = createGenericEntityRequestSchema();
  requestMediaType.examples = createEntityRequestExamples(entityVariants);

  const responseMediaType = ensureJsonResponse(operation, '201');
  responseMediaType.schema = createGenericEntityResponseSchema();
  responseMediaType.examples = createEntityResponseExamples(entityVariants);
}

export function patchEntityUpdateOperation(
  operation: SwaggerOperation | undefined,
  entityVariants: EntitySchemaVariant[],
): void {
  if (!operation) {
    return;
  }

  const requestMediaType = ensureJsonRequest(operation);
  requestMediaType.schema = createGenericEntityRequestSchema();
  requestMediaType.examples = createEntityRequestExamples(entityVariants);

  const responseMediaType = ensureJsonResponse(operation, '200');
  responseMediaType.schema = createGenericEntityResponseSchema();
  responseMediaType.examples = createEntityResponseExamples(entityVariants);
}

export function patchEntityDownloadOperation(
  operation: SwaggerOperation | undefined,
  entityVariants: EntitySchemaVariant[],
): void {
  if (!operation) {
    return;
  }

  const mediaType = ensureJsonResponse(operation, '200');
  mediaType.schema = {
    type: 'array',
    description:
      'Entity-specific download response. Nested references are collapsed to schema names in the examples.',
    items: createGenericEntityResponseSchema(),
  };
  mediaType.examples = Object.fromEntries(
    entityVariants.map((variant) => [
      variant.handle,
      {
        summary: `${variant.handle} download example`,
        value: [cloneExampleValue(variant.responseExample)],
      },
    ]),
  );
}

function ensureJsonRequest(operation: SwaggerOperation): SwaggerMediaType {
  operation.requestBody ??= {
    required: true,
    content: {},
  };
  operation.requestBody.content ??= {};
  operation.requestBody.content[JSON_CONTENT_TYPE] ??= {};
  return operation.requestBody.content[JSON_CONTENT_TYPE];
}

function ensureJsonResponse(
  operation: SwaggerOperation,
  statusCode: string,
): SwaggerMediaType {
  operation.responses ??= {};
  operation.responses[statusCode] ??= { description: '' };
  operation.responses[statusCode].content ??= {};
  operation.responses[statusCode].content[JSON_CONTENT_TYPE] ??= {};
  return operation.responses[statusCode].content[JSON_CONTENT_TYPE];
}

function createGenericEntityRequestSchema(): SwaggerSchema {
  return {
    type: 'object',
    description:
      'Entity-specific request payload for the selected entityHandle. Nested references are omitted from the schema and shown as schema-name strings in the examples.',
    additionalProperties: true,
  };
}

function createGenericEntityResponseSchema(): SwaggerSchema {
  return {
    type: 'object',
    description:
      'Entity-specific response payload. Nested references are omitted from the schema and shown as schema-name strings in the examples.',
    properties: {
      handle: {
        type: 'integer',
      },
    },
    additionalProperties: true,
  };
}

function createEntityRequestExamples(
  entityVariants: EntitySchemaVariant[],
): Record<string, SwaggerExample> {
  return Object.fromEntries(
    entityVariants.map((variant) => [
      variant.handle,
      {
        summary: `${variant.handle} request example`,
        value: cloneExampleValue(variant.requestExample),
      },
    ]),
  );
}

function createEntityResponseExamples(
  entityVariants: EntitySchemaVariant[],
): Record<string, SwaggerExample> {
  return Object.fromEntries(
    entityVariants.map((variant) => [
      variant.handle,
      {
        summary: `${variant.handle} response example`,
        value: cloneExampleValue(variant.responseExample),
      },
    ]),
  );
}

function createPaginatedExamples(
  entityVariants: EntitySchemaVariant[],
): Record<string, SwaggerExample> {
  return Object.fromEntries(
    entityVariants.map((variant) => [
      variant.handle,
      {
        summary: `${variant.handle} list example`,
        value: {
          data: [cloneExampleValue(variant.responseExample)],
          meta: {
            total: 1,
            page: 1,
            limit: 1,
            totalPages: 1,
          },
        },
      },
    ]),
  );
}
