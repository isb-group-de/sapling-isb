import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'

const { apiFindMock } = vi.hoisted(() => ({
  apiFindMock: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: apiFindMock,
  },
  getGenericUpdateConflict: vi.fn(),
}))

vi.mock('@/stores/changeLogDialogStore', () => ({
  useChangeLogDialogStore: () => ({}),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))

vi.mock('@/composables/table/useSaplingTableFavorites', () => ({
  useSaplingTableFavorites: () => ({}),
}))

vi.mock('@/composables/table/useSaplingTableTransferActions', () => ({
  useSaplingTableTransferActions: () => ({}),
}))

vi.mock('@/composables/table/useSaplingTableDeleteActions', () => ({
  useSaplingTableDeleteActions: () => ({}),
}))

vi.mock('@/composables/table/useSaplingTableScripts', () => ({
  useSaplingTableScripts: () => ({}),
}))

vi.mock('@/composables/table/useSaplingTableContextActions', () => ({
  useSaplingTableContextActions: () => ({}),
}))

vi.mock('@/composables/table/useSaplingTableBulkUpdate', () => ({
  useSaplingTableBulkUpdate: () => ({}),
}))

vi.mock('@/composables/dialog/saplingDialogRecordLoader', () => ({
  getDialogRecordRelations: () => ['m:1'],
  getDialogRecordCopyRelations: () => ['m:1', 'participants'],
}))

import { useSaplingTableActions } from '../useSaplingTableActions'

describe('useSaplingTableActions', () => {
  beforeEach(() => {
    apiFindMock.mockReset()
  })

  it('reloads the complete record before copying a projected table row', async () => {
    const templates = [
      template('handle'),
      template('referenceNumber', { isUnique: true }),
      template('title'),
      template('description', { options: ['isMarkdown'], tableVisible: false }),
      template('participants', {
        isReference: true,
        kind: 'm:n',
        referenceName: 'person',
      }),
    ]
    apiFindMock.mockResolvedValue({
      data: [
        {
          handle: 7,
          referenceNumber: 'T-007',
          title: 'Projected title',
          description: '# Complete markdown',
          participants: [{ handle: 9, firstName: 'Ada' }],
        },
      ],
      meta: { total: 1 },
    })

    const actions = useSaplingTableActions({
      props: {
        items: [],
        search: '',
        sortBy: [],
        entityHandle: 'ticket',
        entity: null,
        entityPermission: null,
        entityTemplates: templates,
      },
      emit: vi.fn(),
      localColumnFilters: ref({}),
      selectedItems: ref([]),
      selectedRows: ref([]),
      clearSelection: vi.fn(),
    })

    await actions.openCopyDialog({ handle: 7, title: 'Projected title' })

    expect(apiFindMock).toHaveBeenCalledWith('ticket', {
      filter: { handle: 7 },
      limit: 1,
      relations: ['m:1', 'participants'],
    })
    expect(actions.editDialog.value).toEqual({
      visible: true,
      mode: 'create',
      item: {
        title: 'Projected title',
        description: '# Complete markdown',
        participants: [{ handle: 9, firstName: 'Ada' }],
      },
    })
  })

  it('reopens and resaves a handle-less deferred row as the same local draft', async () => {
    const emit = vi.fn()
    const actions = useSaplingTableActions({
      props: {
        items: [],
        search: '',
        sortBy: [],
        entityHandle: 'effortEstimatePosition',
        entity: null,
        entityPermission: null,
        entityTemplates: [template('title')],
        deferCreate: true,
      },
      emit,
      localColumnFilters: ref({}),
      selectedItems: ref([]),
      selectedRows: ref([]),
      clearSelection: vi.fn(),
    })
    const stagedDraft = { handle: '', title: 'Initial draft' }
    const saveContext = { complete: vi.fn() }

    await actions.openEditDialog(stagedDraft)
    await actions.saveDialog({ title: 'Edited draft' }, 'saveAndClose', saveContext)

    expect(apiFindMock).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'createDraft',
      { title: 'Edited draft' },
      'saveAndClose',
      saveContext,
      stagedDraft,
    )
    expect(saveContext.complete).toHaveBeenCalledWith(true)
    expect(actions.editDialog.value).toMatchObject({ visible: false, mode: 'create' })
  })
})

function template(name: string, overrides: Partial<EntityTemplate> = {}): EntityTemplate {
  return {
    name,
    key: name,
    title: name,
    type: 'string',
    kind: undefined,
    options: [],
    isAutoIncrement: false,
    isPersistent: true,
    tableVisible: true,
    mobileVisible: false,
    isReference: false,
    ...overrides,
  } as EntityTemplate
}
