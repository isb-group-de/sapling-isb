import { SAPLING_MCP_CATALOG_TOOL_DEFINITIONS } from './sapling-mcp-catalog-tool-definitions';
import { SAPLING_MCP_IMPORT_TOOL_DEFINITIONS } from './sapling-mcp-import-tool-definitions';
import { SAPLING_MCP_MUTATION_TOOL_DEFINITIONS } from './sapling-mcp-mutation-tool-definitions';
import { SAPLING_MCP_SEARCH_TOOL_DEFINITIONS } from './sapling-mcp-search-tool-definitions';

export type { SaplingMcpToolDefinition } from './sapling-mcp-tool-definition.types';

export const SAPLING_MCP_TOOL_DEFINITIONS = [
  ...SAPLING_MCP_CATALOG_TOOL_DEFINITIONS,
  ...SAPLING_MCP_SEARCH_TOOL_DEFINITIONS,
  ...SAPLING_MCP_IMPORT_TOOL_DEFINITIONS,
  ...SAPLING_MCP_MUTATION_TOOL_DEFINITIONS,
] as const;
