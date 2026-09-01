import { describe, expect, it } from 'vitest'
import type { Message } from '@/composables/system/useSaplingMessageCenter'
import { createErrorIssuePayload, createMessageCenterExportPayload } from '../messageCenterExport'

const timestamp = new Date('2026-07-30T08:15:30.000Z')
const exportedAt = new Date('2026-07-30T08:16:00.000Z')
const errorMessage: Message = {
  id: 7,
  type: 'error',
  message: 'exception.serverException',
  description: 'Speichern fehlgeschlagen',
  entity: 'ticket',
  timestamp,
  hidden: false,
  count: 1,
  technical: {
    client: { method: 'post', url: '/api/generic/ticket' },
    response: { status: 500, data: { requestId: 'req-123' } },
  },
}

describe('messageCenterExport', () => {
  it('serializes the complete message payload for downloads', () => {
    expect(createMessageCenterExportPayload([errorMessage], exportedAt)).toEqual({
      source: 'sapling-log-message-center',
      exportedAt: '2026-07-30T08:16:00.000Z',
      messages: [
        {
          ...errorMessage,
          timestamp: '2026-07-30T08:15:30.000Z',
        },
      ],
    })
  })

  it('creates a bug issue with the same complete payload in the description', () => {
    const payload = createErrorIssuePayload(
      errorMessage,
      'Tickets: Speichern fehlgeschlagen',
      exportedAt,
    )
    const json = payload.description.replace(/^```json\n|\n```$/g, '')

    expect(payload.title).toBe('Tickets: Speichern fehlgeschlagen')
    expect(payload.type).toBe('bug')
    expect(JSON.parse(json)).toEqual(createMessageCenterExportPayload([errorMessage], exportedAt))
  })

  it('keeps oversized automatic error reports below the API limit with valid JSON', () => {
    const oversizedMessage: Message = {
      ...errorMessage,
      technical: {
        request: 'x'.repeat(14_000),
        response: 'y'.repeat(14_000),
      },
    }

    const payload = createErrorIssuePayload(
      oversizedMessage,
      'Support Queue is not valid for Support Team',
      exportedAt,
    )
    const json = payload.description.replace(/^```json\n|\n```$/g, '')
    const parsed = JSON.parse(json) as {
      truncated: boolean
      originalDescriptionLength: number
      messages: Array<{ diagnosticsPreview: string }>
    }

    expect(payload.description.length).toBeLessThanOrEqual(10_000)
    expect(parsed.truncated).toBe(true)
    expect(parsed.originalDescriptionLength).toBeGreaterThan(10_000)
    expect(parsed.messages[0]?.diagnosticsPreview.length).toBeGreaterThan(0)
  })

  it('adds the reported Sapling page to automatic error reports', () => {
    const payload = createErrorIssuePayload(
      errorMessage,
      'Tickets: Speichern fehlgeschlagen',
      exportedAt,
      'https://sapling.test/table/ticket?view=open',
    )

    expect(payload.sourceUrl).toBe('https://sapling.test/table/ticket?view=open')
  })
})
