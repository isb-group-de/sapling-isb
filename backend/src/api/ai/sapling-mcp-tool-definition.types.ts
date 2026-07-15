import type * as z from 'zod/v4';

export type SaplingMcpToolDefinition = {
  toolName: string;
  description: string;
  jsonSchema: Record<string, unknown>;
  serverInputSchema: Record<string, z.ZodType>;
};
