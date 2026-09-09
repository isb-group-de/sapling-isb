import { computed, effectScope, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type { AccumulatedPermission, DialogSaveContext, EntityTemplate } from '@/entity/structure'
import {
  buildReferenceCreateDraft,
  useSaplingReferenceRecordDialog,
} from '../useSaplingReferenceRecordDialog'

const { create, update, find } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  find: vi.fn(),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/api.generic.service', () => ({ default: { create, update, find } }))
vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))

function setup(allowInsert = true) {
  const scope = effectScope()
  const props = reactive({
    entityHandle: 'company',
    label: 'Company',
    allowCreate: true,
    disabled: false,
    createDefaults: { name: 'Example' },
  })
  const selectedItem = ref<SaplingGenericItem | null>(null)
  const state = scope.run(() =>
    useSaplingReferenceRecordDialog({
      props,
      selectedItem,
      menuOpen: ref(false),
      entity: computed(() => ({ canInsert: true }) as EntityItem),
      entityPermission: computed(
        () => ({ allowInsert, allowRead: true, allowUpdate: true }) as AccumulatedPermission,
      ),
      entityTemplates: computed(() => [{ name: 'name' }] as EntityTemplate[]),
      ensureEntityMetadataLoaded: async () => {},
      clearSelection: () => {
        selectedItem.value = null
      },
    }),
  )!
  return { ...state, props, selectedItem, stop: () => scope.stop() }
}

describe('reference record creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    create.mockResolvedValue({ handle: 5, name: 'Example' })
    find.mockResolvedValue({ data: [{ handle: 5, name: 'Example' }] })
  })
  it('creates and selects the saved record, then switches back to opening', async () => {
    const state = setup()
    expect(state.isCreateAction.value).toBe(true)
    await state.openSelectedRecord()
    expect(state.recordDialogMode.value).toBe('create')
    expect(state.recordDialogItem.value).toEqual({ name: 'Example' })
    const complete = vi.fn()
    const persistPendingRelations = vi.fn().mockResolvedValue(true)
    await state.saveRecordDialog({ name: 'Example' }, 'saveAndClose', {
      complete,
      persistPendingRelations,
    } as DialogSaveContext)
    expect(create).toHaveBeenCalledWith('company', { name: 'Example' })
    expect(persistPendingRelations).toHaveBeenCalledWith(5)
    expect(state.selectedItem.value?.handle).toBe(5)
    expect(state.isCreateAction.value).toBe(false)
    expect(state.recordDialogOpen.value).toBe(false)
    expect(complete).toHaveBeenCalledWith(true)
    state.stop()
  })
  it('does not create on cancel', async () => {
    const state = setup()
    await state.openSelectedRecord()
    state.handleRecordDialogVisibility(false)
    expect(create).not.toHaveBeenCalled()
    expect(state.selectedItem.value).toBeNull()
    state.stop()
  })
  it('preserves pending children and retries against the saved identity', async () => {
    const state = setup()
    await state.openSelectedRecord()
    const complete = vi.fn()
    const persistPendingRelations = vi.fn(async () => {
      expect(state.recordDialogMode.value).toBe('create')
      expect(state.recordDialogItem.value).toEqual({ name: 'Example' })
      return false
    })
    await state.saveRecordDialog({ name: 'Example' }, 'saveAndClose', {
      complete,
      persistPendingRelations,
    } as DialogSaveContext)
    expect(state.recordDialogMode.value).toBe('create')
    expect(state.selectedItem.value).toBeNull()
    update.mockResolvedValue({ handle: 5, name: 'Example' })
    persistPendingRelations.mockResolvedValue(true)
    await state.saveRecordDialog({ name: 'Example' }, 'saveAndClose', {
      complete,
      persistPendingRelations,
    } as DialogSaveContext)
    expect(create).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(state.selectedItem.value?.handle).toBe(5)
    expect(state.recordDialogOpen.value).toBe(false)
    state.stop()
  })
  it('blocks creation without insert permission and on disabled fields', async () => {
    const denied = setup(false)
    await denied.openSelectedRecord()
    expect(denied.recordDialogOpen.value).toBe(false)
    denied.stop()
    const disabled = setup()
    disabled.props.disabled = true
    await disabled.openSelectedRecord()
    expect(disabled.recordDialogOpen.value).toBe(false)
    disabled.stop()
    expect(create).not.toHaveBeenCalled()
  })
  it('keeps a failed draft open for retry without selecting it', async () => {
    create.mockRejectedValue(new Error('save failed'))
    const state = setup()
    await state.openSelectedRecord()
    const complete = vi.fn()
    await state.saveRecordDialog({ name: 'Example' }, 'saveAndClose', {
      complete,
    } as DialogSaveContext)
    expect(state.recordDialogOpen.value).toBe(true)
    expect(state.selectedItem.value).toBeNull()
    expect(complete).toHaveBeenCalledWith(false)
    state.stop()
  })
  it('never prefills hidden, read-only or insert-forbidden target fields', () => {
    expect(
      buildReferenceCreateDraft(
        { name: 'Example', handle: 8, secret: 'x', denied: 1, unknown: 2 },
        [
          { name: 'name' },
          { name: 'handle', isAutoIncrement: true },
          { name: 'secret', options: ['isSecurity'] },
          { name: 'denied', fieldAccess: { allowInsert: false } },
        ] as EntityTemplate[],
      ),
    ).toEqual({ name: 'Example' })
  })
})
