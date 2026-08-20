import { describe, expect, it } from 'vitest'
import { resolvePhoneDialogSubject } from '@/composables/dialog/useSaplingPhoneDialog'

describe('useSaplingPhoneDialog', () => {
  it('uses the metadata-derived record label for any entity', () => {
    expect(
      resolvePhoneDialogSubject({
        phoneNumber: '+49 30 1234567',
        entityHandle: 'ticket',
        recordLabel: 'T-1042 Drucker defekt',
      }),
    ).toBe('T-1042 Drucker defekt')
  })

  it('trims the metadata-derived record label', () => {
    expect(
      resolvePhoneDialogSubject({
        phoneNumber: '+49 30 1234567',
        entityHandle: 'customEntity',
        recordLabel: ' Vorgang Alpha ',
      }),
    ).toBe('Vorgang Alpha')
  })

  it('does not guess a subject from entity-specific field names', () => {
    expect(
      resolvePhoneDialogSubject({
        phoneNumber: '+49 30 1234567',
        entityHandle: 'company',
        draftValues: { name: 'Ignored without isValue metadata' },
      }),
    ).toBe('')
  })
})
