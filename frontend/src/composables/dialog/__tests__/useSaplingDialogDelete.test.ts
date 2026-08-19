import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'

const mocks = vi.hoisted(() => ({
  getDeleteImpact: vi.fn(),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    getDeleteImpact: mocks.getDeleteImpact,
  },
}))

import { useSaplingDialogDelete } from '../useSaplingDialogDelete'

describe('useSaplingDialogDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDeleteImpact.mockResolvedValue({ action: 'delete', references: [] })
  })

  function createHarness() {
    const modelValue = ref(false)
    const item = ref<SaplingGenericItem | SaplingGenericItem[] | null>({ handle: 4 })
    const entityHandle = ref<string | undefined>('company')
    const emit = vi.fn()
    const subject = useSaplingDialogDelete({ modelValue, item, entityHandle }, emit)
    return { emit, modelValue, subject }
  }

  it('loads the delete strategy and owned reference groups when opened', async () => {
    mocks.getDeleteImpact.mockResolvedValue({
      action: 'delete',
      references: [{ name: 'persons', entityHandle: 'person', kind: '1:m' }],
    })
    const harness = createHarness()

    harness.modelValue.value = true
    await nextTick()
    await nextTick()

    expect(mocks.getDeleteImpact).toHaveBeenCalledWith('company', 4)
    expect(harness.subject.hasReferenceOptions.value).toBe(true)
    expect(harness.subject.referenceOptions.value).toEqual([
      { name: 'persons', entityHandle: 'person', kind: '1:m' },
    ])
  })

  it('emits only the explicitly selected relation groups', async () => {
    mocks.getDeleteImpact.mockResolvedValue({
      action: 'delete',
      references: [
        { name: 'persons', entityHandle: 'person', kind: '1:m' },
        { name: 'events', entityHandle: 'event', kind: '1:m' },
      ],
    })
    const harness = createHarness()
    harness.modelValue.value = true
    await nextTick()
    await nextTick()

    harness.subject.selectedReferenceNames.value = ['events']
    harness.subject.handleConfirm()

    expect(harness.emit).toHaveBeenCalledWith('confirm', {
      cascadeRelations: ['events'],
    })
  })

  it('selects and clears all available relation groups', async () => {
    mocks.getDeleteImpact.mockResolvedValue({
      action: 'delete',
      references: [
        { name: 'persons', entityHandle: 'person', kind: '1:m' },
        { name: 'events', entityHandle: 'event', kind: '1:m' },
      ],
    })
    const harness = createHarness()
    harness.modelValue.value = true
    await nextTick()
    await nextTick()

    harness.subject.selectAllReferences()

    expect(harness.subject.selectedReferenceNames.value).toEqual(['persons', 'events'])
    expect(harness.subject.allReferencesSelected.value).toBe(true)

    harness.subject.clearReferenceSelection()

    expect(harness.subject.selectedReferenceNames.value).toEqual([])
    expect(harness.subject.allReferencesSelected.value).toBe(false)
  })

  it('keeps the safe direct-delete behavior when no relation group is selected', () => {
    const harness = createHarness()

    harness.subject.handleConfirm()

    expect(harness.emit).toHaveBeenCalledWith('confirm', {
      cascadeRelations: [],
    })
  })

  it('switches synchronized Events to the cancellation action', async () => {
    mocks.getDeleteImpact.mockResolvedValue({ action: 'cancel', references: [] })
    const harness = createHarness()
    harness.modelValue.value = true
    await nextTick()
    await nextTick()

    expect(harness.subject.isCancelAction.value).toBe(true)
    expect(harness.subject.hasReferenceOptions.value).toBe(false)
  })
})
