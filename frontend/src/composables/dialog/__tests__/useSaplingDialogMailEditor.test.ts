import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findAll: vi.fn(),
  getEntityTemplate: vi.fn(),
  listSenders: vi.fn(),
  preview: vi.fn(),
  fetchCurrentPerson: vi.fn(),
  fetchCurrentPermission: vi.fn(),
  pushMessage: vi.fn(),
  permissions: [] as Array<Record<string, unknown>>,
  isImpersonating: false,
  currentPerson: {
    email: 'sender@example.com',
    company: { handle: 20 },
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: ref('de'),
    t: (key: string) => key,
    te: () => false,
  }),
}))

vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({
    translationService: ref({ prepare: vi.fn().mockResolvedValue(undefined) }),
    isLoading: ref(false),
    loadTranslations: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: mocks.pushMessage }),
}))

vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({
    person: mocks.currentPerson,
    isImpersonating: mocks.isImpersonating,
    fetchCurrentPerson: mocks.fetchCurrentPerson,
  }),
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({
    accumulatedPermission: mocks.permissions,
    fetchCurrentPermission: mocks.fetchCurrentPermission,
  }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: mocks.find,
    findAll: mocks.findAll,
  },
}))

vi.mock('@/services/api.mail.service', () => ({
  default: {
    getEntityTemplate: mocks.getEntityTemplate,
    listSenders: mocks.listSenders,
    preview: mocks.preview,
    send: vi.fn(),
  },
}))

import { useSaplingDialogMailEditor } from '@/composables/dialog/useSaplingDialogMailEditor'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'

describe('useSaplingDialogMailEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSaplingMailDialog().closeMailDialog()
    mocks.fetchCurrentPerson.mockResolvedValue(undefined)
    mocks.fetchCurrentPermission.mockResolvedValue(undefined)
    mocks.permissions = [
      { entityHandle: 'ticket', allowRead: true, allowUpdate: true },
      { entityHandle: 'company', allowRead: true },
      { entityHandle: 'person', allowRead: true },
    ]
    mocks.isImpersonating = false
    mocks.currentPerson.email = 'sender@example.com'
    mocks.currentPerson.company = { handle: 20 }
    mocks.listSenders.mockResolvedValue({ senders: [] })
    mocks.preview.mockResolvedValue({
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      bodyMarkdown: '',
    })
    mocks.getEntityTemplate.mockImplementation(async (entityHandle: string) => {
      if (entityHandle !== 'ticket') {
        return []
      }

      return [
        {
          name: 'assigneeCompany',
          isReference: true,
          referenceName: 'company',
          options: ['isCompany'],
        },
        {
          name: 'creatorCompany',
          isReference: true,
          referenceName: 'company',
          options: ['isCompany', 'isCustomer'],
        },
      ]
    })
    mocks.find.mockResolvedValue({
      data: [
        {
          assigneeCompany: { handle: 10 },
          creatorCompany: { handle: 20 },
        },
      ],
      meta: { totalPages: 1 },
    })
    mocks.findAll.mockImplementation(async (entityHandle: string) => {
      if (entityHandle !== 'person') {
        return []
      }

      return [
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          company: { handle: 20, name: 'Acme GmbH' },
          department: { description: 'Entwicklung' },
        },
      ]
    })
  })

  it('loads contacts from every isCompany context reference of a persisted record', async () => {
    const editor = useSaplingDialogMailEditor()

    useSaplingMailDialog().openMailDialog({
      entityHandle: 'ticket',
      itemHandle: 99,
    })

    await vi.waitFor(() => expect(editor.recipientOptions.value).toHaveLength(1))
    await nextTick()

    expect(mocks.find).toHaveBeenCalledWith(
      'ticket',
      expect.objectContaining({
        filter: { handle: 99 },
        relations: ['assigneeCompany', 'creatorCompany'],
      }),
    )
    expect(mocks.findAll).toHaveBeenCalledWith(
      'person',
      expect.objectContaining({
        filter: { company: { $in: [10, 20] } },
        relations: ['company', 'department'],
      }),
    )
    expect(editor.recipientOptions.value).toEqual([
      {
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        companyHandle: 20,
        companyName: 'Acme GmbH',
        departmentName: 'Entwicklung',
        isCurrentCompany: true,
      },
    ])
    expect(mocks.findAll).not.toHaveBeenCalledWith('emailTemplate', expect.anything())
    expect(mocks.findAll).not.toHaveBeenCalledWith('document', expect.anything())
  })

  it('adds the current user company without context companies and deduplicates contact emails', async () => {
    mocks.currentPerson.company = { handle: 30 }
    mocks.getEntityTemplate.mockResolvedValue([
      { name: 'title', type: 'string', isPersistent: true },
    ])
    mocks.findAll.mockImplementation(async (entityHandle: string) => {
      if (entityHandle !== 'person') {
        return []
      }

      return [
        {
          firstName: 'Zoe',
          lastName: 'Colleague',
          email: 'shared@example.com',
          company: { handle: 30, name: 'Eigene GmbH' },
          department: { description: 'Support' },
        },
        {
          firstName: 'Ada',
          lastName: 'Current',
          email: 'SHARED@example.com',
          company: { handle: 30, name: 'Eigene GmbH' },
          department: { description: 'Entwicklung' },
        },
      ]
    })
    const editor = useSaplingDialogMailEditor()

    useSaplingMailDialog().openMailDialog({
      entityHandle: 'ticket',
    })

    await vi.waitFor(() => expect(editor.recipientOptions.value).toHaveLength(1))

    expect(mocks.findAll).toHaveBeenCalledWith(
      'person',
      expect.objectContaining({
        filter: { company: { $in: [30] } },
      }),
    )
    expect(editor.recipientOptions.value[0]).toEqual(
      expect.objectContaining({
        email: 'SHARED@example.com',
        name: 'Ada Current',
        companyName: 'Eigene GmbH',
      }),
    )
  })

  it('keeps readable placeholders and skips reference templates without read access', async () => {
    mocks.getEntityTemplate.mockImplementation(async (entityHandle: string) => {
      if (entityHandle === 'ticket') {
        return [
          { name: 'title', type: 'string', isPersistent: true },
          {
            name: 'customerCompany',
            isReference: true,
            referenceName: 'company',
            kind: 'm:1',
          },
          {
            name: 'opportunity',
            isReference: true,
            referenceName: 'salesOpportunity',
            kind: 'm:1',
          },
        ]
      }
      if (entityHandle === 'company') {
        return [{ name: 'name', type: 'string', isPersistent: true }]
      }
      throw new Error(`Unexpected template request: ${entityHandle}`)
    })

    const editor = useSaplingDialogMailEditor()
    useSaplingMailDialog().openMailDialog({ entityHandle: 'ticket', itemHandle: 99 })

    await vi.waitFor(() =>
      expect(
        editor.placeholderGroups.value.flatMap((group) => group.items.map((item) => item.token)),
      ).toEqual(['{{customerCompany.name}}', '{{title}}']),
    )

    expect(mocks.getEntityTemplate).toHaveBeenCalledWith('ticket', { reportError: false })
    expect(mocks.getEntityTemplate).toHaveBeenCalledWith('company', { reportError: false })
    expect(mocks.getEntityTemplate).not.toHaveBeenCalledWith('salesOpportunity', expect.anything())
    expect(mocks.pushMessage).not.toHaveBeenCalledWith(
      'warning',
      'mail.placeholdersLoadFailed',
      expect.anything(),
      'mail',
    )
  })

  it('never exposes sending while impersonating', async () => {
    mocks.isImpersonating = true
    const editor = useSaplingDialogMailEditor()
    useSaplingMailDialog().openMailDialog({ entityHandle: 'ticket', itemHandle: 99 })

    await vi.waitFor(() => expect(mocks.fetchCurrentPermission).toHaveBeenCalled())

    expect(editor.canSendMail.value).toBe(false)
  })
})
