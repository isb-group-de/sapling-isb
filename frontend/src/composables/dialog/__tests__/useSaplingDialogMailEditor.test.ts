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
    person: { email: 'sender@example.com' },
    fetchCurrentPerson: mocks.fetchCurrentPerson,
  }),
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({
    accumulatedPermission: [{ entityHandle: 'person', allowRead: true }],
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
        companyName: 'Acme GmbH',
        departmentName: 'Entwicklung',
      },
    ])
  })
})
