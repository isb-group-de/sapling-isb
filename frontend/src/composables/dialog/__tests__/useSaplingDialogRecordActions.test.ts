import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AccumulatedPermission } from '@/entity/structure'
import type { EntityItem } from '@/entity/entity'
import { useSaplingDialogRecordActions } from '../useSaplingDialogRecordActions'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/composables/dialog/useSaplingMailDialog', () => ({
  useSaplingMailDialog: () => ({ openMailDialog: vi.fn() }),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))

vi.mock('@/stores/changeLogDialogStore', () => ({
  useChangeLogDialogStore: () => ({ openChangeLog: vi.fn() }),
}))

vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({
    isAdministrator: false,
    person: null,
    fetchCurrentPerson: vi.fn(),
  }),
}))

vi.mock('@/stores/timelineDialogStore', () => ({
  useTimelineDialogStore: () => ({ openTimeline: vi.fn() }),
}))

function createRecordActions(permissions: AccumulatedPermission[]) {
  return useSaplingDialogRecordActions(
    {
      modelValue: false,
      mode: 'edit',
      item: { handle: 19 },
      entity: {
        handle: 'ticket',
        canRead: true,
        canInsert: true,
        canUpdate: true,
        canDelete: true,
        canShow: true,
      } as EntityItem,
      templates: [],
    },
    vi.fn(),
    {
      activeTab: ref(0),
      form: ref({}),
      formConfigMenuItems: computed(() => []),
      isDirty: computed(() => false),
      isSaving: computed(() => false),
      permissions: ref(permissions),
      selectFormConfig: vi.fn(),
    },
  )
}

describe('useSaplingDialogRecordActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides delete when the entity supports deletion but the user is not allowed to delete', () => {
    const actions = createRecordActions([
      {
        entityHandle: 'ticket',
        allowRead: true,
        allowUpdate: true,
        allowDelete: false,
      },
    ])

    expect(actions.canDeleteRecord.value).toBe(false)
  })

  it('shows delete when the user has the effective delete permission', () => {
    const actions = createRecordActions([
      {
        entityHandle: 'ticket',
        allowRead: true,
        allowUpdate: true,
        allowDelete: true,
      },
    ])

    expect(actions.canDeleteRecord.value).toBe(true)
  })

  it('offers merging only with read, update and delete permissions', () => {
    for (const denied of ['allowRead', 'allowUpdate', 'allowDelete', null]) {
      const permission: AccumulatedPermission = {
        entityHandle: 'ticket',
        allowRead: true,
        allowUpdate: true,
        allowDelete: true,
      }
      if (denied) Object.assign(permission, { [denied]: false })
      const actions = createRecordActions([permission])
      const menu = actions.recordActionMenuItems.value.flat()
      expect(menu.some((entry) => entry.type === 'merge')).toBe(denied === null)
    }
  })

  it('opens the merge workflow from a persisted record action', async () => {
    const actions = createRecordActions([
      { entityHandle: 'ticket', allowRead: true, allowUpdate: true, allowDelete: true },
    ])
    await actions.handleRecordAction({ type: 'merge', icon: 'mdi-source-merge' })
    expect(actions.recordMergeDialog.value).toBe(true)
  })
})
