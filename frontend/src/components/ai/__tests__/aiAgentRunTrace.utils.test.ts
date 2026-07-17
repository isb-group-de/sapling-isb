import { describe, expect, it } from 'vitest'
import type { AiAgentRunItem } from '@/entity/entity'
import {
  formatRunDuration,
  formatRunError,
  formatRunSourceTitle,
  getRunRepairHints,
  getRunToolCalls,
  getRunUsageMetrics,
  getTraceArguments,
} from '../aiAgentRunTrace.utils'

function createRun(patch: Partial<AiAgentRunItem> = {}): AiAgentRunItem {
  return {
    person: 1,
    status: 'completed',
    ...patch,
  } as AiAgentRunItem
}

describe('AI agent run trace utilities', () => {
  it('normalizes trace arrays and provider-specific token names', () => {
    const run = createRun({
      toolCalls: [
        { toolName: 'generic_list', repairHints: ['Use entity_schema first.'] },
        null,
      ] as unknown as Record<string, unknown>[],
      usagePayload: {
        promptTokenCount: 1250,
        candidatesTokenCount: 320,
        totalTokenCount: 1570,
      },
    })

    expect(getRunToolCalls(run)).toHaveLength(1)
    expect(getRunRepairHints(run)).toEqual(['Use entity_schema first.'])
    expect(getRunUsageMetrics(run)).toEqual({
      inputTokens: 1250,
      outputTokens: 320,
      totalTokens: 1570,
    })
  })

  it('formats durations into readable units', () => {
    expect(formatRunDuration(37, 'en')).toBe('37 ms')
    expect(formatRunDuration('10239' as unknown as number, 'en')).toBe('10 s')
    expect(formatRunDuration(10_239, 'en')).toBe('10 s')
    expect(formatRunDuration(423_830, 'en')).toBe('7 min 4 s')
  })

  it('prefers navigation paths and extracts a useful error message', () => {
    expect(formatRunSourceTitle({ kind: 'navigation', path: '/table/ticket?filter=active' })).toBe(
      '/table/ticket?filter=active',
    )
    expect(formatRunError(createRun({ errorPayload: { message: 'Provider unavailable' } }))).toBe(
      'Provider unavailable',
    )
  })

  it('keeps tool arguments bounded while retaining their meaning', () => {
    const [argument] = getTraceArguments({
      arguments: { filter: { description: 'x'.repeat(400) } },
    })

    expect(argument.key).toBe('filter')
    expect(argument.value).toHaveLength(240)
    expect(argument.value.endsWith('…')).toBe(true)
  })
})
