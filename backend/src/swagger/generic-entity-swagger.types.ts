export type SwaggerSchema = {
  $ref?: string;
  allOf?: SwaggerSchema[];
  anyOf?: SwaggerSchema[];
  oneOf?: SwaggerSchema[];
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  nullable?: boolean;
  enum?: unknown[];
  properties?: Record<string, SwaggerSchema>;
  items?: SwaggerSchema;
  additionalProperties?: boolean | SwaggerSchema;
  required?: string[];
  example?: unknown;
  default?: unknown;
  readOnly?: boolean;
  writeOnly?: boolean;
};

export type SwaggerExample = {
  summary: string;
  value: unknown;
};

export type SwaggerMediaType = {
  schema?: SwaggerSchema;
  examples?: Record<string, SwaggerExample>;
  example?: unknown;
};

type SwaggerRequestBody = {
  description?: string;
  required?: boolean;
  content?: Record<string, SwaggerMediaType>;
};

type SwaggerResponse = {
  description?: string;
  content?: Record<string, SwaggerMediaType>;
};

export type SwaggerOperation = {
  requestBody?: SwaggerRequestBody;
  responses?: Record<string, SwaggerResponse>;
};

export type SwaggerDocument = {
  paths?: Record<
    string,
    | {
        get?: SwaggerOperation;
        post?: SwaggerOperation;
        patch?: SwaggerOperation;
        delete?: SwaggerOperation;
      }
    | undefined
  >;
  components?: {
    schemas?: Record<string, SwaggerSchema>;
  };
};

export type ExampleMode = 'request' | 'response';

export type EntitySchemaVariant = {
  handle: string;
  requestExample: unknown;
  responseExample: unknown;
};

export type EntityRegistryEntry = {
  name: string;
  class: {
    name: string;
  };
};
