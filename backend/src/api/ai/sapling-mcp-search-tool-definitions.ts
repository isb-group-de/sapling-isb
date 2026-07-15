import * as z from 'zod/v4';
import { SAPLING_MCP_TOOL_DESCRIPTIONS } from './prompts/sapling-mcp.prompts';
import type { SaplingMcpToolDefinition } from './sapling-mcp-tool-definition.types';

export const SAPLING_MCP_SEARCH_TOOL_DEFINITIONS: readonly SaplingMcpToolDefinition[] =
  [
    {
      toolName: 'ticket_search',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.ticketSearch,
      jsonSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search text matched against TicketItem text fields.',
          },
          searchMode: {
            type: 'string',
            enum: ['all', 'problem', 'solution'],
            description:
              'Search scope. Use solution for known fixes, problem for incident descriptions, default all.',
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of matches to return, default 10.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      serverInputSchema: {
        query: z
          .string()
          .describe('Search text matched against TicketItem text fields.'),
        searchMode: z
          .enum(['all', 'problem', 'solution'])
          .optional()
          .describe(
            'Search scope. Use solution for known fixes, problem for incident descriptions, default all.',
          ),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe('Maximum number of matches to return, default 10.'),
      },
    },
    {
      toolName: 'semantic_search',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.semanticSearch,
      jsonSchema: {
        type: 'object',
        properties: {
          entityHandle: {
            type: 'string',
            description:
              'Registered Sapling entity handle with an active vector index, for example ticket, event, salesOpportunity, effortEstimate, or effortEstimatePosition.',
          },
          query: {
            type: 'string',
            description:
              'Natural-language query that should be matched semantically against vectorized content.',
          },
          limit: {
            type: 'integer',
            description:
              'Maximum number of semantic results to return, default 5.',
          },
        },
        required: ['entityHandle', 'query'],
        additionalProperties: false,
      },
      serverInputSchema: {
        entityHandle: z
          .string()
          .describe(
            'Registered Sapling entity handle with an active vector index, for example ticket, event, salesOpportunity, effortEstimate, or effortEstimatePosition.',
          ),
        query: z
          .string()
          .describe(
            'Natural-language query that should be matched semantically against vectorized content.',
          ),
        limit: z
          .number()
          .int()
          .positive()
          .max(20)
          .optional()
          .describe('Maximum number of semantic results to return, default 5.'),
      },
    },
    {
      toolName: 'knowledge_search',
      description: SAPLING_MCP_TOOL_DESCRIPTIONS.knowledgeSearch,
      jsonSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Natural-language knowledge question or problem description.',
          },
          entityHandles: {
            type: 'array',
            description:
              'Optional subset of indexed knowledge sources. Defaults to knowledgeArticle, ticket, effortEstimate, effortEstimatePosition, and salesOpportunity.',
            items: { type: 'string' },
          },
          limit: {
            type: 'integer',
            description:
              'Maximum combined result size across all knowledge sources, default 8.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      serverInputSchema: {
        query: z
          .string()
          .describe(
            'Natural-language knowledge question or problem description.',
          ),
        entityHandles: z
          .array(z.string())
          .optional()
          .describe(
            'Optional subset of indexed knowledge sources. Defaults to knowledgeArticle, ticket, effortEstimate, effortEstimatePosition, and salesOpportunity.',
          ),
        limit: z
          .number()
          .int()
          .positive()
          .max(30)
          .optional()
          .describe(
            'Maximum combined result size across all knowledge sources, default 8.',
          ),
      },
    },
  ];
