import type {
  ExampleMode,
  SwaggerSchema,
} from './generic-entity-swagger.types';

const ROOT_REQUEST_EXCLUDED_FIELDS = new Set([
  'handle',
  'createdAt',
  'updatedAt',
]);

type ExampleContext = {
  mode: ExampleMode;
  depth: number;
  seenRefs: Set<string>;
  propertyName: string;
};

export function buildRootEntityExample(
  schemaName: string,
  components: Record<string, SwaggerSchema>,
  mode: ExampleMode,
): unknown {
  const rawExample = buildExampleFromSchema(
    { $ref: `#/components/schemas/${schemaName}` },
    components,
    {
      mode,
      depth: 0,
      seenRefs: new Set<string>(),
      propertyName: schemaName,
    },
  );

  if (mode !== 'request' || !isPlainObject(rawExample)) {
    return rawExample;
  }

  const sanitizedExample = { ...rawExample };
  for (const field of ROOT_REQUEST_EXCLUDED_FIELDS) {
    delete sanitizedExample[field];
  }

  return sanitizedExample;
}

function buildExampleFromSchema(
  schema: SwaggerSchema | undefined,
  components: Record<string, SwaggerSchema>,
  context: ExampleContext,
): unknown {
  if (!schema) {
    return {};
  }

  if (schema.example !== undefined) {
    return cloneExampleValue(schema.example);
  }

  if (schema.default !== undefined) {
    return cloneExampleValue(schema.default);
  }

  if (schema.enum && schema.enum.length > 0) {
    return cloneExampleValue(schema.enum[0]);
  }

  if (schema.$ref) {
    return buildExampleFromReference(schema.$ref, components, context);
  }

  if (schema.allOf && schema.allOf.length > 0) {
    return schema.allOf.reduce<Record<string, unknown>>((accumulator, part) => {
      const partExample = buildExampleFromSchema(part, components, context);
      if (isPlainObject(partExample)) {
        return { ...accumulator, ...partExample };
      }

      return accumulator;
    }, {});
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    return buildExampleFromSchema(schema.oneOf[0], components, context);
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    return buildExampleFromSchema(schema.anyOf[0], components, context);
  }

  if (schema.type === 'array') {
    return [
      buildExampleFromSchema(schema.items, components, {
        ...context,
        depth: context.depth + 1,
        propertyName: singularize(context.propertyName),
      }),
    ];
  }

  if (
    schema.type === 'object' ||
    schema.properties ||
    schema.additionalProperties
  ) {
    return buildObjectExample(schema, components, context);
  }

  if (schema.nullable) {
    return null;
  }

  return buildPrimitiveExample(schema, context.propertyName);
}

function buildExampleFromReference(
  reference: string,
  components: Record<string, SwaggerSchema>,
  context: ExampleContext,
): unknown {
  const schemaName = reference.split('/').pop();
  if (!schemaName) {
    return {};
  }

  if (context.depth > 0 || context.seenRefs.has(reference)) {
    return schemaName;
  }

  const targetSchema = components[schemaName];
  if (!targetSchema) {
    return {};
  }

  context.seenRefs.add(reference);
  const resolvedExample = buildExampleFromSchema(
    targetSchema,
    components,
    context,
  );
  context.seenRefs.delete(reference);
  return resolvedExample;
}

function buildObjectExample(
  schema: SwaggerSchema,
  components: Record<string, SwaggerSchema>,
  context: ExampleContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [propertyName, propertySchema] of Object.entries(
    schema.properties ?? {},
  )) {
    if (context.mode === 'request' && propertySchema.readOnly) {
      continue;
    }

    if (context.mode === 'response' && propertySchema.writeOnly) {
      continue;
    }

    result[propertyName] = buildExampleFromSchema(propertySchema, components, {
      ...context,
      depth: context.depth + 1,
      propertyName,
    });
  }

  if (Object.keys(result).length === 0 && schema.additionalProperties) {
    if (schema.additionalProperties === true) {
      return { key: 'value' };
    }

    return {
      key: buildExampleFromSchema(schema.additionalProperties, components, {
        ...context,
        depth: context.depth + 1,
        propertyName: 'key',
      }),
    };
  }

  return result;
}

function buildPrimitiveExample(
  schema: SwaggerSchema,
  propertyName: string,
): boolean | number | string | null {
  switch (schema.type) {
    case 'boolean':
      return false;
    case 'integer':
      return propertyName === 'handle' ? 1 : 0;
    case 'number':
      return 0;
    case 'string':
      return buildStringExample(propertyName, schema.format);
    default:
      return null;
  }
}

function buildStringExample(propertyName: string, format?: string): string {
  switch (format) {
    case 'date-time':
      return '2026-01-01T12:00:00.000Z';
    case 'date':
      return '2026-01-01';
    case 'email':
      return 'max.mustermann@example.com';
    case 'uri':
    case 'url':
      return 'https://example.com';
    case 'uuid':
      return '123e4567-e89b-12d3-a456-426614174000';
    default:
      break;
  }

  const normalizedPropertyName = propertyName.toLowerCase();

  if (normalizedPropertyName.includes('firstname')) {
    return 'Max';
  }

  if (normalizedPropertyName.includes('lastname')) {
    return 'Mustermann';
  }

  if (
    normalizedPropertyName.includes('email') ||
    normalizedPropertyName.includes('mail')
  ) {
    return 'max.mustermann@example.com';
  }

  if (
    normalizedPropertyName.includes('phone') ||
    normalizedPropertyName.includes('mobile')
  ) {
    return '+49 30 1234567';
  }

  if (normalizedPropertyName.includes('street')) {
    return 'Musterstrasse 1';
  }

  if (normalizedPropertyName.includes('zip')) {
    return '10115';
  }

  if (normalizedPropertyName.includes('city')) {
    return 'Berlin';
  }

  if (normalizedPropertyName.includes('country')) {
    return 'DE';
  }

  if (normalizedPropertyName.includes('language')) {
    return 'de';
  }

  if (normalizedPropertyName.includes('color')) {
    return '#4CAF50';
  }

  if (
    normalizedPropertyName.includes('website') ||
    normalizedPropertyName.includes('url')
  ) {
    return 'https://example.com';
  }

  if (normalizedPropertyName.includes('description')) {
    return 'Beispielbeschreibung';
  }

  if (normalizedPropertyName.includes('title')) {
    return 'Beispieltitel';
  }

  if (normalizedPropertyName === 'name') {
    return 'Beispiel';
  }

  if (normalizedPropertyName.includes('handle')) {
    return '1';
  }

  return `${propertyName} value`;
}

function singularize(value: string): string {
  return value.endsWith('s') ? value.slice(0, -1) : value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function cloneExampleValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
