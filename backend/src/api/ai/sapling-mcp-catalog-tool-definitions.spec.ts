import { describe, expect, it } from '@jest/globals';
import { GENERIC_LIST_MAX_LIMIT } from '../../constants/project.constants';
import { SAPLING_MCP_CATALOG_TOOL_DEFINITIONS } from './sapling-mcp-catalog-tool-definitions';

describe('Sapling MCP catalog tool definitions', () => {
  it('limits generic_list pages to the generic API maximum', () => {
    const definition = SAPLING_MCP_CATALOG_TOOL_DEFINITIONS.find(
      ({ toolName }) => toolName === 'generic_list',
    );
    const jsonLimit = (
      definition?.jsonSchema.properties as Record<string, unknown> | undefined
    )?.limit as { maximum?: number } | undefined;
    const zodLimit = (
      definition?.serverInputSchema as {
        limit?: {
          safeParse(value: unknown): { success: boolean };
        };
      }
    )?.limit;

    expect(jsonLimit?.maximum).toBe(GENERIC_LIST_MAX_LIMIT);
    expect(zodLimit?.safeParse(GENERIC_LIST_MAX_LIMIT).success).toBe(true);
    expect(zodLimit?.safeParse(GENERIC_LIST_MAX_LIMIT + 1).success).toBe(false);
  });
});
