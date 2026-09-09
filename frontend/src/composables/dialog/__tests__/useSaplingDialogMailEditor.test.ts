import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findAll: vi.fn(),
  getEntityTemplate: vi.fn(),
  listSenders: vi.fn(),
  resolveContextCc: vi.fn(),
  preview: vi.fn(),
  send: vi.fn(),
  fetchCurrentPerson: vi.fn(),
  fetchCurrentPermission: vi.fn(),
  pushMessage: vi.fn(),
  permissions: [] as Array<Record<string, unknown>>,
  isImpersonating: false,
  currentPerson: {
    handle: 7,
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

vi.mock('@/services/api.mail-signature.service', () => ({
  loadMailSignatureSettings: vi
    .fn()
    .mockResolvedValue({ signatureRotation: true, defaultSignatureHandle: null }),
}))

vi.mock('@/services/api.mail.service', () => ({
  default: {
    getEntityTemplate: mocks.getEntityTemplate,
    listSenders: mocks.listSenders,
    resolveContextCc: mocks.resolveContextCc,
    preview: mocks.preview,
    send: mocks.send,
  },
}))

import { useSaplingDialogMailEditor as createMailEditor } from '@/composables/dialog/useSaplingDialogMailEditor'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'

const scopes: ReturnType<typeof effectScope>[] = []
function useSaplingDialogMailEditor() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(createMailEditor)!
}
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  useSaplingMailDialog().closeMailDialog()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useSaplingDialogMailEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.send.mockResolvedValue({ handle: 1 })
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
    mocks.resolveContextCc.mockResolvedValue({ additionalCc: [] })
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

  it('includes contacts from the customer company service provider', async () => {
    mocks.currentPerson.company = { handle: 10 }
    mocks.findAll.mockImplementation(async (entityHandle: string) => {
      if (entityHandle === 'company') {
        return [{ handle: 20, serviceProvider: { handle: 30 } }]
      }
      if (entityHandle === 'person') {
        return [
          {
            firstName: 'Clara',
            lastName: 'Customer',
            email: 'clara@customer.example',
            company: { handle: 20, name: 'Customer GmbH' },
          },
          {
            firstName: 'Dora',
            lastName: 'Provider',
            email: 'dora@provider.example',
            company: { handle: 30, name: 'Provider GmbH' },
          },
        ]
      }
      return []
    })
    const editor = useSaplingDialogMailEditor()

    useSaplingMailDialog().openMailDialog({
      entityHandle: 'ticket',
      itemHandle: 99,
    })

    await vi.waitFor(() => expect(editor.recipientOptions.value).toHaveLength(2))

    expect(mocks.findAll).toHaveBeenCalledWith('company', {
      filter: { handle: { $in: [20] } },
      relations: ['serviceProvider'],
      fields: ['handle', 'serviceProvider', 'serviceProvider.handle'],
      suppressErrorMessage: true,
    })
    expect(mocks.findAll).toHaveBeenCalledWith(
      'person',
      expect.objectContaining({
        filter: { company: { $in: [10, 20, 30] } },
      }),
    )
    expect(editor.recipientOptions.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'dora@provider.example',
          companyHandle: 30,
          companyName: 'Provider GmbH',
        }),
      ]),
    )
  })

  it('adds configured customer CC recipients once and keeps them removable', async () => {
    mocks.resolveContextCc.mockResolvedValue({
      additionalCc: ['audit@example.com'],
    })
    const editor = useSaplingDialogMailEditor()

    useSaplingMailDialog().openMailDialog({
      entityHandle: 'ticket',
      itemHandle: 99,
      initialTo: ['customer@example.com'],
    })

    await vi.waitFor(() => expect(editor.ccRecipients.value).toEqual(['audit@example.com']))
    expect(mocks.resolveContextCc).toHaveBeenCalledWith(
      expect.objectContaining({
        entityHandle: 'ticket',
        itemHandle: 99,
        to: ['customer@example.com'],
        cc: [],
        bcc: [],
      }),
      { reportError: false },
    )

    mocks.resolveContextCc.mockClear()
    editor.ccRecipients.value = []
    await editor.refreshPreview()

    expect(editor.ccRecipients.value).toEqual([])
    expect(mocks.resolveContextCc).not.toHaveBeenCalled()
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

  it('restores edits after reopening and keeps them when the grace period is cancelled', async () => {
    const editor = useSaplingDialogMailEditor()
    const dialog = useSaplingMailDialog()
    const context = { entityHandle: 'ticket', itemHandle: 99 }
    dialog.openMailDialog(context)
    await vi.waitFor(() => expect(editor.canSendMail.value).toBe(true))
    editor.subject.value = 'Saved subject'
    editor.bodyMarkdown.value = 'Saved text'
    editor.toRecipients.value = ['to@example.com']
    editor.closeMailDialog()
    await nextTick()
    dialog.openMailDialog(context)
    await vi.waitFor(() => expect(editor.canSendMail.value).toBe(true))
    expect(editor.subject.value).toBe('Saved subject')
    expect(editor.bodyMarkdown.value).toBe('Saved text')
    expect(editor.toRecipients.value).toEqual(['to@example.com'])
    mocks.preview.mockResolvedValue({
      to: ['to@example.com'],
      cc: [],
      bcc: [],
      subject: 'Saved subject',
      bodyMarkdown: 'Saved text',
    })
    vi.useFakeTimers()
    await editor.sendMail()
    expect(editor.isHolding.value).toBe(true)
    editor.cancelPendingSend()
    editor.closeMailDialog()
    await vi.advanceTimersByTimeAsync(11000)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(1)
  })

  it.each([false, true])(
    'sends immediately on close and preserves the next composer (failure: %s)',
    async (fails) => {
      const editor = useSaplingDialogMailEditor()
      const dialog = useSaplingMailDialog()
      dialog.openMailDialog({ entityHandle: 'ticket', itemHandle: 99 })
      await vi.waitFor(() => expect(editor.canSendMail.value).toBe(true))
      editor.subject.value = 'Original'
      editor.toRecipients.value = ['to@example.com']
      mocks.preview.mockResolvedValue({
        to: ['to@example.com'],
        cc: [],
        bcc: [],
        subject: 'Original',
        bodyMarkdown: 'Text',
      })
      let finish!: () => void
      mocks.send.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = () => (fails ? reject(new Error('offline')) : resolve({}))
          }),
      )
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await editor.sendMail()
      expect(editor.isHolding.value).toBe(true)
      editor.closeMailDialog()
      expect(mocks.send).toHaveBeenCalledTimes(1)
      expect(dialog.isOpen.value).toBe(false)
      await nextTick()
      dialog.openMailDialog({ entityHandle: 'ticket', itemHandle: 100 })
      await vi.waitFor(() => expect(editor.canSendMail.value).toBe(true))
      editor.subject.value = 'Next message'
      finish()
      await vi.waitFor(() =>
        expect(mocks.pushMessage).toHaveBeenCalledWith(
          fails ? 'error' : 'success',
          fails ? 'mail.sendFailed' : 'mail.sendQueued',
          expect.anything(),
          'mail',
        ),
      )
      expect(dialog.isOpen.value).toBe(true)
      expect(editor.subject.value).toBe('Next message')
      expect(localStorage.length).toBe(fails ? 2 : 1)
      expect(mocks.send).toHaveBeenCalledTimes(1)
    },
  )

  it('sends immediately when the pending countdown is confirmed', async () => {
    const editor = useSaplingDialogMailEditor()
    useSaplingMailDialog().openMailDialog({ entityHandle: 'ticket', itemHandle: 99 })
    await vi.waitFor(() => expect(editor.canSendMail.value).toBe(true))
    editor.toRecipients.value = ['to@example.com']
    mocks.preview.mockResolvedValue({
      to: ['to@example.com'],
      cc: [],
      bcc: [],
      subject: 'Test',
      bodyMarkdown: 'Text',
    })
    vi.useFakeTimers()

    await editor.sendMail()
    expect(editor.isHolding.value).toBe(true)

    editor.sendPendingNow()

    expect(editor.isHolding.value).toBe(false)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(11000)
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('requires warning acknowledgement and clears the draft only after successful queuing', async () => {
    const editor = useSaplingDialogMailEditor()
    useSaplingMailDialog().openMailDialog({ entityHandle: 'ticket', itemHandle: 99 })
    await vi.waitFor(() => expect(editor.canSendMail.value).toBe(true))
    editor.toRecipients.value = ['to@example.com']
    editor.bodyMarkdown.value = 'Please see attached'
    mocks.preview.mockResolvedValue({
      to: ['to@example.com'],
      cc: [],
      bcc: [],
      subject: '',
      bodyMarkdown: 'Please see attached',
      signatureHandle: 12,
    })
    vi.useFakeTimers()
    await editor.sendMail()
    expect(editor.isHolding.value).toBe(false)
    expect(editor.sendIssues.value).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(11000)
    expect(mocks.send).not.toHaveBeenCalled()
    editor.confirmSend()
    await vi.advanceTimersByTimeAsync(9999)
    expect(mocks.send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ signatureHandle: 12, bodyMarkdown: 'Please see attached' }),
    )
    expect(localStorage.length).toBe(0)
    expect(editor.isOpen.value).toBe(false)
  })

  it('retains the draft after a send failure and invalidates an acknowledged review on edits', async () => {
    const editor = useSaplingDialogMailEditor()
    useSaplingMailDialog().openMailDialog({ entityHandle: 'ticket', itemHandle: 99 })
    await vi.waitFor(() => expect(editor.canSendMail.value).toBe(true))
    editor.toRecipients.value = ['to@example.com']
    mocks.preview.mockResolvedValue({
      to: ['to@example.com'],
      cc: [],
      bcc: [],
      subject: 'Test',
      bodyMarkdown: 'Text',
    })
    mocks.send.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    await editor.sendMail()
    editor.bodyMarkdown.value = 'Changed'
    await vi.advanceTimersByTimeAsync(11000)
    expect(mocks.send).not.toHaveBeenCalled()
    await editor.sendMail()
    await vi.advanceTimersByTimeAsync(10000)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(editor.isOpen.value).toBe(true)
    expect(localStorage.length).toBe(1)
    expect(editor.canSendMail.value).toBe(true)
  })
})
