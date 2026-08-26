import { describe, expect, it } from 'vitest'
import { formatRunSourceMeta, formatRunSourceTitle, getRunSourceUrl } from './aiAgentRunTrace.utils'

describe('aiAgentRunTrace web sources', () => {
  it('uses the citation title and exposes only safe external URLs', () => {
    const source = {
      kind: 'web',
      title: 'NPAL Impressum',
      url: 'https://example.com/impressum',
      providerHandle: 'gemini',
      modelHandle: 'gemini-3_5-flash',
    }

    expect(formatRunSourceTitle(source)).toBe('NPAL Impressum')
    expect(formatRunSourceMeta(source)).toEqual(['web', 'gemini · gemini-3_5-flash'])
    expect(getRunSourceUrl(source)).toBe('https://example.com/impressum')
    expect(getRunSourceUrl({ url: 'javascript:alert(1)' })).toBeNull()
  })
})
