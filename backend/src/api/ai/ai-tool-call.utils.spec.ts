import { describe, expect, it } from '@jest/globals';
import {
  buildToolRegistry,
  buildUnknownToolError,
  resolveMaxToolCallIterations,
} from './ai-tool-call.utils';

describe('resolveMaxToolCallIterations', () => {
  it('uses 100 as the default fallback', () => {
    expect(
      resolveMaxToolCallIterations({ maxToolCallIterations: null } as never),
    ).toBe(100);
  });

  it('keeps configured positive values', () => {
    expect(
      resolveMaxToolCallIterations({ maxToolCallIterations: 100 } as never),
    ).toBe(100);
  });
});

describe('buildUnknownToolError', () => {
  it('returns the canonical available names so the model can repair its call', () => {
    const registry = buildToolRegistry([
      { serverName: 'sapling', toolName: 'entity_search' },
      { serverName: 'sapling', toolName: 'entity_schema' },
    ] as never);

    expect(buildUnknownToolError(registry, 'sapling__generic_search')).toEqual({
      ok: false,
      toolName: 'sapling__generic_search',
      error: 'ai.toolNotFound:sapling__generic_search',
      hints: [
        'Use exactly one of the available tool names: sapling__entity_search, sapling__entity_schema',
      ],
    });
  });
});
