import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openTimeline: vi.fn(),
  openChangeLog: vi.fn(),
  openMailDialog: vi.fn(),
  openDocumentView: vi.fn(),
  openDvelopUploadDialog: vi.fn(),
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

function createSubject(showActions = true) {
  const callbacks = {
    loadItem: vi.fn(async (item) => ({ ...item, title: 'Loaded' })),
    editItem: vi.fn(),
    showItem: vi.fn(),
    copyItem: vi.fn(),
    deleteItem: vi.fn(),
    runScript: vi.fn(),
  }
  const props = reactive({
    entityHandle: 'ticket',
    entityTemplates: [],
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
})
