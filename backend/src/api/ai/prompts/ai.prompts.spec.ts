import { describe, expect, it } from '@jest/globals';
import {
  AI_SYSTEM_PROMPT_TOOL_GUIDANCE,
  buildSystemInstruction,
} from './ai.prompts';
import {
  SAPLING_MCP_TOOL_DESCRIPTIONS,
  SAPLING_MCP_USAGE_HINTS,
} from './sapling-mcp.prompts';

describe('AI tool guidance', () => {
  it('routes self-scoped calendar questions through the authenticated person and event', () => {
    expect(AI_SYSTEM_PROMPT_TOOL_GUIDANCE).toContain(
      'Welche Termine habe ich heute?',
    );
    expect(AI_SYSTEM_PROMPT_TOOL_GUIDANCE).toContain('current_person');
    expect(AI_SYSTEM_PROMPT_TOOL_GUIDANCE).toContain('participants');
    expect(AI_SYSTEM_PROMPT_TOOL_GUIDANCE).toContain(
      'do not load reverse collections',
    );
    expect(buildSystemInstruction({ includeToolGuidance: true })).toContain(
      'answer the original question instead of describing the JSON payload',
    );
  });

  it('marks generic list payloads as tool output and forbids current-person name searches', () => {
    expect(SAPLING_MCP_TOOL_DESCRIPTIONS.currentPerson).toContain(
      'Never identify the current user by searching person records by name',
    );
    expect(SAPLING_MCP_TOOL_DESCRIPTIONS.genericList).toContain(
      'filter event records by participants and date overlap',
    );
    expect(SAPLING_MCP_USAGE_HINTS.genericList).toEqual(
      expect.arrayContaining([
        expect.stringContaining('not a new dataset supplied by the user'),
        expect.stringContaining('Do not load person.assignedEvents'),
      ]),
    );
  });
});
