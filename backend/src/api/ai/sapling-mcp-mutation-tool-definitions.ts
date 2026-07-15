import * as z from 'zod/v4';
import { SAPLING_MCP_TOOL_DESCRIPTIONS } from './prompts/sapling-mcp.prompts';
import type { SaplingMcpToolDefinition } from './sapling-mcp-tool-definition.types';

export const SAPLING_MCP_MUTATION_TOOL_DEFINITIONS: readonly SaplingMcpToolDefinition[] =
  [
    {
      toolName: 'generic_create',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.genericCreate,
      jsonSchema: {
        type: 'object',
        properties: {
          entityHandle: {
            type: 'string',
            description: 'Registered Sapling entity handle.',
          },
          data: {
            type: 'object',
            description: 'Payload for the new record.',
            additionalProperties: true,
          },
        },
        required: ['entityHandle', 'data'],
        additionalProperties: false,
      },
      serverInputSchema: {
        entityHandle: z.string().describe('Registered Sapling entity handle.'),
        data: z
          .record(z.string(), z.unknown())
          .describe('Payload for the new record.'),
      },
    },
    {
      toolName: 'generic_update',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.genericUpdate,
      jsonSchema: {
        type: 'object',
        properties: {
          entityHandle: {
            type: 'string',
            description: 'Registered Sapling entity handle.',
          },
          handle: {
            anyOf: [{ type: 'string' }, { type: 'integer' }],
            description: 'Record handle to update.',
          },
          data: {
            type: 'object',
            description: 'Partial update payload.',
            additionalProperties: true,
          },
          relations: {
            type: 'array',
            description: 'Optional relations to populate in the response.',
            items: { type: 'string' },
          },
        },
        required: ['entityHandle', 'handle', 'data'],
        additionalProperties: false,
      },
      serverInputSchema: {
        entityHandle: z.string().describe('Registered Sapling entity handle.'),
        handle: z
          .union([z.string(), z.number()])
          .describe('Record handle to update.'),
        data: z
          .record(z.string(), z.unknown())
          .describe('Partial update payload.'),
        relations: z
          .array(z.string())
          .optional()
          .describe('Optional relations to populate in the response.'),
      },
    },
    {
      toolName: 'generic_delete',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.genericDelete,
      jsonSchema: {
        type: 'object',
        properties: {
          entityHandle: {
            type: 'string',
            description: 'Registered Sapling entity handle.',
          },
          handle: {
            anyOf: [{ type: 'string' }, { type: 'integer' }],
            description: 'Record handle to delete.',
          },
        },
        required: ['entityHandle', 'handle'],
        additionalProperties: false,
      },
      serverInputSchema: {
        entityHandle: z.string().describe('Registered Sapling entity handle.'),
        handle: z
          .union([z.string(), z.number()])
          .describe('Record handle to delete.'),
      },
    },
  ];
