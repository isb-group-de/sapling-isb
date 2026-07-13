import { describe, expect, it } from 'vitest'
import { getSaplingContextMenuTableItems } from '../useSaplingContextMenuTable'
import { buildMailMenuActions } from '@/utils/saplingMailMenuUtil'
import type { EntityTemplate } from '@/entity/structure'

describe('inbound email context menu behavior', () => {
  it('offers document viewing for persisted read-only records without offering uploads', () => {
    const entries = getSaplingContextMenuTableItems({
      canChangeLog: true,
      canShowInformation: false,
      entityPermission: {
        entityHandle: 'inboundEmail',
        allowRead: true,
        allowInsert: false,
        allowUpdate: false,
        allowDelete: false,
        allowShow: true,
      },
      canNavigate: false,
      canTimeline: true,
    })
    const actions = entries.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))

    expect(actions.some((action) => action.type === 'showDocuments')).toBe(true)
    expect(actions.some((action) => action.type === 'uploadDocument')).toBe(false)
  })

  it('ignores relation objects and uses only actual string mail fields', () => {
    const templates = [
      { name: 'mailbox', options: ['isMail'] },
      { name: 'fromAddress', options: ['isMail'] },
    ] as EntityTemplate[]

    expect(
      buildMailMenuActions(templates, {
        handle: 4,
        mailbox: { handle: 2, description: 'Support' },
        fromAddress: ' Customer@Example.com ',
      }),
    ).toEqual([
      {
        templateName: 'fromAddress',
        email: 'Customer@Example.com',
        fieldLabel: 'fromAddress',
      },
    ])
  })
})
