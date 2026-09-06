import { afterEach, describe, expect, it } from 'vitest'
import {
  resolvePhoneDialogEmails,
  resolvePhoneDialogSubject,
  useSaplingPhoneDialog,
} from '@/composables/dialog/useSaplingPhoneDialog'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import type { EntityTemplate } from '@/entity/structure'

const mailTemplates: EntityTemplate[] = [
  { key: 'email', name: 'email', type: 'string', options: ['isMail'] },
  { key: 'billingEmail', name: 'billingEmail', type: 'string', options: ['isMail'] },
  {
    key: 'companyEmail',
    name: 'companyEmail',
    type: 'string',
    options: ['isMail'],
    isPersistent: false,
  },
]

describe('useSaplingPhoneDialog', () => {
  afterEach(() => {
    useSaplingPhoneDialog().closePhoneDialog()
    useSaplingMailDialog().closeMailDialog()
  })

  it.each([undefined, null, '', '   ', 42])(
    'does not offer a related company address when the record email is %s',
    (email) => {
      expect(
        resolvePhoneDialogEmails({
          phoneNumber: '+49 30 1234567',
          entityTemplates: mailTemplates,
          draftValues: { email, companyEmail: 'company@example.com' },
        }),
      ).toEqual([])
    },
  )

  it('requires mail metadata even if a field happens to be named email', () => {
    expect(
      resolvePhoneDialogEmails({
        phoneNumber: '+49 30 1234567',
        draftValues: { email: 'ada@example.com' },
      }),
    ).toEqual([])
    expect(resolvePhoneDialogEmails(null)).toEqual([])
  })

  it('trims and deduplicates own addresses case-insensitively', () => {
    expect(
      resolvePhoneDialogEmails({
        phoneNumber: '+49 30 1234567',
        entityTemplates: mailTemplates,
        draftValues: {
          email: ' Ada@example.com ',
          billingEmail: 'ada@example.com',
          companyEmail: 'company@example.com',
        },
      }),
    ).toEqual(['Ada@example.com'])
  })

  it.each(['company', 'person', 'customEntity'])(
    'opens mail for %s with only the chosen address and keeps the call open',
    (entityHandle) => {
      const phone = useSaplingPhoneDialog()
      const mail = useSaplingMailDialog()
      const draftValues = { email: 'ada@example.com', billingEmail: 'billing@example.com' }
      phone.openPhoneDialog({
        phoneNumber: '+49 30 1234567',
        entityHandle,
        itemHandle: 42,
        draftValues,
        recordLabel: 'Ada',
        entityTemplates: mailTemplates,
      })

      expect(phone.emailRecipients.value).toEqual(['ada@example.com', 'billing@example.com'])
      phone.composeEmail('billing@example.com')

      expect(mail.isOpen.value).toBe(true)
      expect(mail.context.value).toEqual({
        entityHandle,
        itemHandle: 42,
        draftValues,
        recordLabel: 'Ada',
        initialTo: ['billing@example.com'],
      })
      expect(phone.isOpen.value).toBe(true)
      expect(phone.context.value?.draftValues).toEqual(draftValues)
    },
  )

  it('clears recipient availability when switching to a record without email', () => {
    const phone = useSaplingPhoneDialog()
    phone.openPhoneDialog({
      phoneNumber: '+49 30 1234567',
      entityHandle: 'company',
      entityTemplates: mailTemplates,
      draftValues: { email: 'ada@example.com' },
    })
    phone.openPhoneDialog({ phoneNumber: '+49 30 7654321', entityHandle: 'company' })
    expect(phone.emailRecipients.value).toEqual([])
    phone.composeEmail('ada@example.com')
    expect(useSaplingMailDialog().isOpen.value).toBe(false)
  })

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
