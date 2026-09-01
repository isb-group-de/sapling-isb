import { afterEach, describe, expect, it } from 'vitest'
import { useSaplingMessageCenter } from '../useSaplingMessageCenter'

describe('useSaplingMessageCenter', () => {
  const messageCenter = useSaplingMessageCenter()

  afterEach(() => {
    messageCenter.clearAll()
  })

  it('counts repeated failures without duplicating identical diagnostics', () => {
    const technical = {
      client: {
        code: 'ERR_NETWORK',
        method: 'get',
        url: '/api/generic/ticketStatus',
      },
    }

    messageCenter.pushMessage(
      'error',
      'exception.connectionException',
      'exception.connectionExceptionDescription',
      'ticketStatus',
      technical,
    )
    messageCenter.pushMessage(
      'error',
      'exception.connectionException',
      'exception.connectionExceptionDescription',
      'ticketStatus',
      { ...technical, client: { ...technical.client } },
    )

    expect(messageCenter.messages.value).toHaveLength(1)
    expect(messageCenter.messages.value[0]).toMatchObject({
      count: 2,
      technical,
    })
  })
})
