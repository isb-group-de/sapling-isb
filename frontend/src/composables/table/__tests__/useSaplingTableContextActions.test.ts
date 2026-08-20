import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openTimeline: vi.fn(),
  openChangeLog: vi.fn(),
  openMailDialog: vi.fn(),
  openDocumentView: vi.fn(),
  openDvelopUploadDialog: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({
    accumulatedPermission: [{ entityHandle: 'information', allowRead: true }],
  }),
}))

vi.mock('@/stores/timelineDialogStore', () => ({
  useTimelineDialogStore: () => ({ openTimeline: mocks.openTimeline }),
}))

vi.mock('@/stores/changeLogDialogStore', () => ({
  useChangeLogDialogStore: () => ({ openChangeLog: mocks.openChangeLog }),
}))

vi.mock('@/composables/dialog/useSaplingMailDialog', () => ({
  useSaplingMailDialog: () => ({ openMailDialog: mocks.openMailDialog }),
}))

vi.mock('@/utils/saplingDocumentActionUtil', () => ({
  openDocumentView: mocks.openDocumentView,
  openDvelopUploadDialog: mocks.openDvelopUploadDialog,
}))

import { useSaplingTableContextActions } from '../useSaplingTableContextActions'
import type { EntityTemplate } from '@/entity/structure'

function createSubject(
  showActions = true,
  entityHandle = 'ticket',
  entityTemplates: EntityTemplate[] = [],
) {
  const callbacks = {
    loadItem: vi.fn(async (item) => ({ ...item, title: 'Loaded' })),
    editItem: vi.fn(),
    showItem: vi.fn(),
    copyItem: vi.fn(),
    deleteItem: vi.fn(),
    runScript: vi.fn(),
  }
  const props = reactive({
    entityHandle,
    entityTemplates,
    showActions,
  })

  return {
    callbacks,
    subject: useSaplingTableContextActions({ props, ...callbacks }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.openDvelopUploadDialog.mockResolvedValue(false)
})

describe('useSaplingTableContextActions', () => {
  it('hydrates the menu item and routes actions through explicit callbacks', async () => {
    const { callbacks, subject } = createSubject()

    await subject.openContextMenu({ item: { handle: 4 }, index: 0, x: 10, y: 20 })
    expect(subject.contextMenu.value).toEqual({
      visible: true,
      item: { handle: 4, title: 'Loaded' },
      x: 10,
      y: 20,
    })

    subject.onContextMenuAction({
      type: 'edit',
      item: { handle: 4 },
    })

    expect(callbacks.editItem).toHaveBeenCalledWith({ handle: 4 })
    expect(subject.contextMenu.value.visible).toBe(false)
  })

  it('does not hydrate or open a context menu when actions are disabled', async () => {
    const { callbacks, subject } = createSubject(false)

    await subject.openContextMenu({ item: { handle: 4 }, index: 0, x: 10, y: 20 })

    expect(callbacks.loadItem).not.toHaveBeenCalled()
    expect(subject.contextMenu.value.visible).toBe(false)
  })

  it('opens the Customer 360 route for company context actions', () => {
    const { subject } = createSubject(true, 'company')

    subject.onContextMenuAction({ type: 'customer360', item: { handle: 42 } })

    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'customer360',
      params: { entityHandle: 'company', handle: '42' },
    })
  })

  it('passes the generic isValue label to the mail composer context', () => {
    const { subject } = createSubject(true, 'customWorkItem', [
      { name: 'caseNumber', type: 'string', options: ['isValue'] } as EntityTemplate,
      { name: 'summary', type: 'string', options: ['isValue'] } as EntityTemplate,
    ])

    subject.onContextMenuAction({
      type: 'mail',
      item: { handle: 42, caseNumber: 'T-1042', summary: 'Drucker defekt' },
      mailAction: {
        templateName: 'creatorPersonEmail',
        email: 'creator@example.com',
        fieldLabel: 'Creator',
        source: 'record',
      },
    })

    expect(mocks.openMailDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        initialTo: ['creator@example.com'],
        recordLabel: 'T-1042 Drucker defekt',
      }),
    )
  })
})
