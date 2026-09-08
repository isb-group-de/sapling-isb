import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMailDraft, type MailDraft } from '../useMailDraft'
import { inspectMail, useMailSendGuard } from '../useMailSendGuard'
import { useMailAttachmentUpload } from '../useMailAttachmentUpload'
import type { MailPreviewResult } from '@/services/api.mail.service'

const mocks = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/services/api.document.service', () => ({ default: { upload: mocks.upload } }))

const draft: MailDraft = {
  subject: 'Test',
  bodyMarkdown: 'Hallo',
  to: ['to@example.com'],
  cc: [],
  bcc: [],
  senderEmail: 'from@example.com',
  templateHandle: null,
  attachmentHandles: [4],
  signatureRotation: false,
  signatureHandle: 3,
}
const preview: MailPreviewResult = {
  entityHandle: 'ticket',
  to: ['to@example.com'],
  cc: [],
  bcc: [],
  subject: 'Test',
  bodyMarkdown: 'Hallo',
  bodyHtml: '<p>Hallo</p>',
  attachmentHandles: [],
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('mail drafts', () => {
  it('cleans the captured draft after close without deleting a newer draft for the same record', () => {
    const storage = useMailDraft()
    storage.openDraft([1, 'ticket', 4])
    storage.saveDraft(draft)
    const cleanup = storage.captureDraftCleanup(draft)
    storage.detachDraft()
    storage.openDraft([1, 'ticket', 4])
    storage.saveDraft({ ...draft, subject: 'Next message' })
    cleanup()
    expect(storage.openDraft([1, 'ticket', 4])?.subject).toBe('Next message')
  })
  it('does not erase a newer draft when an earlier send completes', () => {
    const storage = useMailDraft()
    storage.openDraft([1])
    storage.saveDraft({ ...draft, subject: 'New message' })
    storage.clearDraft(draft)
    expect(storage.openDraft([1])?.subject).toBe('New message')
  })
  it('restores complete drafts only for the same user and record', () => {
    const first = useMailDraft()
    first.openDraft([1, 'ticket', 4])
    first.saveDraft(draft)
    const reopened = useMailDraft()
    expect(reopened.openDraft([2, 'ticket', 4])).toBeNull()
    expect(reopened.openDraft([1, 'ticket', 5])).toBeNull()
    expect(reopened.openDraft([1, 'ticket', 4])).toEqual(draft)
    expect(reopened.draftStatus.value).toBe('restored')
    reopened.clearDraft()
    expect(first.openDraft([1, 'ticket', 4])).toBeNull()
  })

  it('reports unavailable storage and rejects corrupt drafts', () => {
    const storage = useMailDraft()
    storage.openDraft([1])
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    storage.saveDraft(draft)
    expect(storage.draftStatus.value).toBe('failed')
    vi.restoreAllMocks()
    localStorage.setItem('sapling:mail-draft:v1:[1]', '{"subject":3}')
    expect(storage.openDraft([1])).toBeNull()
    expect(storage.draftStatus.value).toBe('failed')
  })

  it('does not save later changes under a detached identity', () => {
    const storage = useMailDraft()
    storage.openDraft([1])
    storage.saveDraft(draft)
    storage.detachDraft()
    storage.saveDraft({ ...draft, subject: 'Wrong user' })
    expect(storage.openDraft([1])?.subject).toBe('Test')
  })
})

describe('mail send review and grace period', () => {
  it('detects empty subjects, attachments and empty placeholders', () => {
    expect(
      inspectMail({
        ...preview,
        subject: ' ',
        bodyMarkdown: 'Anbei die Rechnung',
        unresolvedPlaceholders: ['{{name}}'],
      }).map((issue) => issue.key),
    ).toEqual(['mail.checkSubject', 'mail.checkPlaceholders', 'mail.checkAttachments'])
    expect(inspectMail({ ...preview, bodyMarkdown: 'Attached', attachmentHandles: [1] })).toEqual(
      [],
    )
  })

  it('blocks missing To, invalid addresses and duplicates across all recipient fields', () => {
    expect(inspectMail({ ...preview, to: [], cc: ['a@example.com'] })).toContainEqual({
      key: 'mail.checkRecipients',
      blocking: true,
    })
    const issues = inspectMail({ ...preview, cc: ['TO@example.com'], bcc: ['invalid'] })
    expect(issues).toContainEqual({
      key: 'mail.checkDuplicates',
      detail: 'to@example.com',
      blocking: true,
    })
    expect(issues).toContainEqual({ key: 'mail.checkInvalidRecipients', blocking: true })
  })

  it('dispatches exactly once only after ten seconds', async () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const guard = scope.run(useMailSendGuard)!
    const send = vi.fn().mockResolvedValue(undefined)
    guard.holdSend(send)
    await vi.advanceTimersByTimeAsync(9999)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10001)
    expect(send).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it.each(['cancel', 'dispose', 'pagehide'])('cancels dispatch on %s', async (action) => {
    vi.useFakeTimers()
    const scope = effectScope()
    const guard = scope.run(useMailSendGuard)!
    const send = vi.fn().mockResolvedValue(undefined)
    guard.holdSend(send)
    await vi.advanceTimersByTimeAsync(3000)
    if (action === 'cancel') guard.cancelPendingSend()
    if (action === 'dispose') scope.stop()
    if (action === 'pagehide') window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(15000)
    expect(send).not.toHaveBeenCalled()
    expect(guard.isHolding.value).toBe(false)
    scope.stop()
  })

  it('flushes the countdown once and never sends again when its timer expires', async () => {
    vi.useFakeTimers()
    const guard = useMailSendGuard()
    const send = vi.fn().mockResolvedValue(undefined)
    guard.holdSend(send)
    await vi.advanceTimersByTimeAsync(3000)
    guard.sendPendingNow()
    guard.sendPendingNow()
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(11000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(guard.isHolding.value).toBe(false)
  })
})

describe('mail attachment uploads', () => {
  it('keeps successful attachments and reports partial failures', async () => {
    mocks.upload
      .mockResolvedValueOnce({ handle: 5, filename: 'a.txt' })
      .mockRejectedValueOnce(new Error('upload'))
    const accept = vi.fn()
    const upload = useMailAttachmentUpload({
      target: () => ({ entity: 'ticket', reference: '4', generation: 1 }),
      accept,
    })
    await upload.uploadAttachments([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')])
    expect(mocks.upload.mock.calls[0][0]).toBe('ticket')
    expect(mocks.upload.mock.calls[0][2].get('typeHandle')).toBe('document')
    expect(accept).toHaveBeenCalledWith({ handle: 5, filename: 'a.txt', title: 'a.txt' })
    expect(upload.failedUploads.value).toEqual(['b.txt'])
    expect(upload.isUploading.value).toBe(false)
  })

  it('does not attach results to another dialog or start uploads without permission', async () => {
    let resolve!: (document: unknown) => void
    mocks.upload.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    let target: { entity: string; reference: string; generation: number } | null = {
      entity: 'ticket',
      reference: '4',
      generation: 1,
    }
    const accept = vi.fn()
    const upload = useMailAttachmentUpload({ target: () => target, accept })
    const pending = upload.uploadAttachments([new File(['a'], 'a.txt')])
    target = null
    resolve({ handle: 5, filename: 'a.txt' })
    await pending
    await upload.uploadAttachments([new File(['b'], 'b.txt')])
    expect(accept).not.toHaveBeenCalled()
    expect(mocks.upload).toHaveBeenCalledTimes(1)
  })
})
