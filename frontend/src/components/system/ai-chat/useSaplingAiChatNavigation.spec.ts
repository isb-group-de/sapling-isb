import { describe, expect, it } from 'vitest'
import { singularizeEntityLabel } from './useSaplingAiChatNavigation'

describe('useSaplingAiChatNavigation', () => {
  it('keeps singular entity labels that already end in s intact', () => {
    expect(singularizeEntityLabel('Ereignis')).toBe('Ereignis')
    expect(singularizeEntityLabel('Status')).toBe('Status')
  })

  it('singularizes supported plural entity labels', () => {
    expect(singularizeEntityLabel('Tickets')).toBe('Ticket')
    expect(singularizeEntityLabel('Companies')).toBe('Company')
  })
})
