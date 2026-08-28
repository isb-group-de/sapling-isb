import { nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  getSaplingContextMenuTableItems,
  useSaplingContextMenuTable,
  type SaplingContextMenuTableEmit,
} from '../useSaplingContextMenuTable'
import { buildMailMenuActions } from '@/utils/saplingMailMenuUtil'
import type { EntityTemplate } from '@/entity/structure'

describe('Sapling table context menu', () => {
  it('exposes the pointer coordinates as a connected menu target', async () => {
    const props = reactive({
      canShowInformation: false,
      entityPermission: null,
      canNavigate: false,
      item: { handle: 4 },
      show: true,
      x: 120,
      y: 680,
    })
    const emit = vi.fn() as unknown as SaplingContextMenuTableEmit
    const menu = useSaplingContextMenuTable(props, emit)

    expect(menu.menuTarget.value).toEqual([120, 680])

    props.x = 240
    props.y = 80
    await nextTick()

    expect(menu.menuTarget.value).toEqual([240, 80])
  })

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
        recipientName: '',
        source: 'record',
      },
    ])
  })

  it('keeps the direct customer action and adds a separate department submenu', () => {
    const entries = getSaplingContextMenuTableItems({
      canChangeLog: false,
      canShowInformation: false,
      entityPermission: { entityHandle: 'company', allowUpdate: true },
      canNavigate: false,
      canTimeline: false,
      mailToLabel: 'E-Mail senden an',
      mailActions: [
        {
          templateName: 'creatorPersonEmail',
          email: 'ada@example.com',
          recipientName: 'Ada Lovelace',
          source: 'record',
        },
        {
          templateName: 'customerCompanyContact',
          email: 'ada@example.com',
          recipientName: 'Ada Lovelace',
          department: { handle: 'it', title: 'IT', icon: 'mdi-laptop' },
          source: 'customerContact',
        },
      ],
    })
    const mailItems = entries
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry) => entry.type === 'mail')
    const directAction = mailItems.find((entry) => entry.mailAction?.source === 'record')
    const mailRoot = mailItems.find((entry) => (entry.children?.length ?? 0) > 0)

    expect(directAction).toMatchObject({
      title: 'E-Mail senden an Ada Lovelace',
      mailAction: { email: 'ada@example.com' },
    })
    expect(mailRoot?.title).toBe('E-Mail senden an')
    expect(mailRoot?.title).not.toContain('ada@example.com')
    expect(mailRoot?.children?.[0]).toMatchObject({
      title: 'IT',
      icon: 'mdi-laptop',
      children: [
        expect.objectContaining({
          title: 'Ada Lovelace',
          mailAction: expect.objectContaining({ email: 'ada@example.com' }),
        }),
      ],
    })
  })

  it('does not offer mail actions without update permission on the context entity', () => {
    const entries = getSaplingContextMenuTableItems({
      canChangeLog: false,
      canShowInformation: false,
      entityPermission: { entityHandle: 'company', allowRead: true, allowUpdate: false },
      canNavigate: false,
      canTimeline: false,
      mailActions: [
        {
          templateName: 'email',
          email: 'customer@example.com',
          source: 'record',
        },
      ],
    })
    const actions = entries.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))

    expect(actions.some((action) => action.type === 'mail')).toBe(false)
  })

  it('only offers external record links when the caller confirms read permission', async () => {
    const props = reactive({
      canShowInformation: false,
      canShowExternalRecordLinks: false,
      entityPermission: null,
      canNavigate: false,
      item: { handle: 4 },
      show: true,
      x: 0,
      y: 0,
    })
    const emit = vi.fn() as unknown as SaplingContextMenuTableEmit
    const menu = useSaplingContextMenuTable(props, emit)
    const actions = () =>
      menu.menuItems.value.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))

    expect(actions().some((action) => action.type === 'showExternalRecordLinks')).toBe(false)

    props.canShowExternalRecordLinks = true
    await nextTick()

    expect(actions().some((action) => action.type === 'showExternalRecordLinks')).toBe(true)
  })
})
