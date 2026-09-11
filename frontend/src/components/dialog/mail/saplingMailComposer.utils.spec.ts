import { describe, expect, it } from 'vitest'
import type { MailRecipientOption } from './SaplingDialogMail.types'
import {
  assignMailMentionRecipient,
  filterMailMentionRecipients,
  findMailRecipientMention,
} from './saplingMailComposer.utils'

describe('mail recipient mentions', () => {
  it('finds the active mention at the caret without matching email addresses', () => {
    expect(findMailRecipientMention('Hallo @Ada Lo', { from: 13, to: 13 })).toEqual({
      from: 6,
      to: 13,
      query: 'Ada Lo',
    })
    expect(
      findMailRecipientMention('Bitte an info@example.com senden', { from: 27, to: 27 }),
    ).toBeNull()
    expect(findMailRecipientMention('Hallo @Ada', { from: 6, to: 10 })).toBeNull()
  })

  it('filters names, companies, departments and emails accent-insensitively', () => {
    const recipients: MailRecipientOption[] = [
      {
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        companyName: 'Analytical Engines',
        departmentName: 'Entwicklung',
      },
      {
        email: 'angelika@example.com',
        name: 'Angelika Böhm',
        companyName: 'König Handels GmbH',
        departmentName: 'Einkauf',
      },
    ]

    expect(filterMailMentionRecipients(recipients, 'bohm konig')).toEqual([recipients[1]])
    expect(filterMailMentionRecipients(recipients, 'entwicklung')).toEqual([recipients[0]])
  })

  it('moves the selected address into exactly one target field', () => {
    expect(
      assignMailMentionRecipient(
        {
          to: ['Ada@Example.com', 'other@example.com'],
          cc: ['ada@example.com'],
          bcc: ['third@example.com'],
        },
        'bcc',
        'ada@example.com',
      ),
    ).toEqual({
      to: ['other@example.com'],
      cc: [],
      bcc: ['third@example.com', 'ada@example.com'],
    })
  })
})
