import * as z from 'zod/v4';
import { SAPLING_MCP_TOOL_DESCRIPTIONS } from './prompts/sapling-mcp.prompts';
import type { SaplingMcpToolDefinition } from './sapling-mcp-tool-definition.types';

export const SAPLING_MCP_IMPORT_TOOL_DEFINITIONS: readonly SaplingMcpToolDefinition[] =
  [
    {
      toolName: 'import_get_batch',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.importGetBatch,
      jsonSchema: {
        type: 'object',
        properties: {
          batchHandle: {
            type: 'integer',
            description: 'Import batch handle to inspect.',
          },
        },
        required: ['batchHandle'],
        additionalProperties: false,
      },
      serverInputSchema: {
        batchHandle: z
          .number()
          .int()
          .positive()
          .describe('Import batch handle to inspect.'),
      },
    },
    {
      toolName: 'import_list_templates',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.importListTemplates,
      jsonSchema: {
        type: 'object',
        properties: {
          entityHandle: {
            type: 'string',
            description: 'Optional target entity handle.',
          },
          sourceHandle: {
            type: 'string',
            description: 'Optional external import source handle.',
          },
        },
        additionalProperties: false,
      },
      serverInputSchema: {
        entityHandle: z
          .string()
          .optional()
          .describe('Optional target entity handle.'),
        sourceHandle: z
          .string()
          .optional()
          .describe('Optional external import source handle.'),
      },
    },
    {
      toolName: 'import_suggest_mapping',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.importSuggestMapping,
      jsonSchema: {
        type: 'object',
        properties: {
          batchHandle: {
            type: 'integer',
            description: 'Analyzed import batch handle.',
          },
          entityHandle: {
            type: 'string',
            description: 'Optional target entity handle.',
          },
          sourceHandle: {
            type: 'string',
            description: 'Optional external import source handle.',
          },
          maxSampleRows: {
            type: 'integer',
            description: 'Maximum sample rows sent to the suggestion model.',
          },
        },
        required: ['batchHandle'],
        additionalProperties: false,
      },
      serverInputSchema: {
        batchHandle: z
          .number()
          .int()
          .positive()
          .describe('Analyzed import batch handle.'),
        entityHandle: z
          .string()
          .optional()
          .describe('Optional target entity handle.'),
        sourceHandle: z
          .string()
          .optional()
          .describe('Optional external import source handle.'),
        maxSampleRows: z
          .number()
          .int()
          .positive()
          .max(20)
          .optional()
          .describe('Maximum sample rows sent to the suggestion model.'),
      },
    },
    {
      toolName: 'import_match_existing_records',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.importMatchExistingRecords,
      jsonSchema: {
        type: 'object',
        properties: {
          batchHandle: {
            type: 'integer',
            description: 'Import batch handle whose rows should be checked.',
          },
          entityHandle: {
            type: 'string',
            description: 'Target Sapling entity handle to search.',
          },
          sourceColumns: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional source columns to use. Defaults to configured mapping columns or all batch headers.',
          },
          targetFields: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional target entity fields to search. Defaults to common display/search fields.',
          },
          sampleLimit: {
            type: 'integer',
            description: 'Maximum import rows to inspect, default 10.',
          },
          limitPerValue: {
            type: 'integer',
            description:
              'Maximum Sapling matches per sampled value, default 3.',
          },
        },
        required: ['batchHandle', 'entityHandle'],
        additionalProperties: false,
      },
      serverInputSchema: {
        batchHandle: z
          .number()
          .int()
          .positive()
          .describe('Import batch handle whose rows should be checked.'),
        entityHandle: z
          .string()
          .describe('Target Sapling entity handle to search.'),
        sourceColumns: z
          .array(z.string())
          .optional()
          .describe('Optional source columns to use.'),
        targetFields: z
          .array(z.string())
          .optional()
          .describe('Optional target entity fields to search.'),
        sampleLimit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe('Maximum import rows to inspect, default 10.'),
        limitPerValue: z
          .number()
          .int()
          .positive()
          .max(10)
          .optional()
          .describe('Maximum Sapling matches per sampled value, default 3.'),
      },
    },
    {
      toolName: 'import_configure_batch',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.importConfigureBatch,
      jsonSchema: {
        type: 'object',
        properties: {
          batchHandle: {
            type: 'integer',
            description: 'Import batch handle to configure.',
          },
          entityHandle: {
            type: 'string',
            description: 'Target Sapling entity handle.',
          },
          sourceHandle: {
            type: 'string',
            description: 'Optional external import source handle.',
          },
          templateHandle: {
            type: 'integer',
            description: 'Optional import template handle.',
          },
          keyColumns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional external key source columns.',
          },
          mappings: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
            description: 'Field mappings from source columns to target fields.',
          },
          relationMappings: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
            description: 'Relation mapping configuration.',
          },
          valueMappings: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
            description: 'Value mapping configuration.',
          },
          genericReferenceMapping: {
            type: 'object',
            additionalProperties: true,
            description: 'Optional generic reference mapping.',
          },
        },
        required: ['batchHandle', 'entityHandle'],
        additionalProperties: false,
      },
      serverInputSchema: {
        batchHandle: z
          .number()
          .int()
          .positive()
          .describe('Import batch handle to configure.'),
        entityHandle: z.string().describe('Target Sapling entity handle.'),
        sourceHandle: z
          .string()
          .optional()
          .describe('Optional external import source handle.'),
        templateHandle: z.number().int().positive().optional(),
        keyColumns: z.array(z.string()).optional(),
        mappings: z.array(z.record(z.string(), z.unknown())).optional(),
        relationMappings: z.array(z.record(z.string(), z.unknown())).optional(),
        valueMappings: z.array(z.record(z.string(), z.unknown())).optional(),
        genericReferenceMapping: z.record(z.string(), z.unknown()).optional(),
      },
    },
    {
      toolName: 'import_execute_batch',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.importExecuteBatch,
      jsonSchema: {
        type: 'object',
        properties: {
          batchHandle: {
            type: 'integer',
            description: 'Validated import batch handle to execute.',
          },
        },
        required: ['batchHandle'],
        additionalProperties: false,
      },
      serverInputSchema: {
        batchHandle: z
          .number()
          .int()
          .positive()
          .describe('Validated import batch handle to execute.'),
      },
    },
  ];
