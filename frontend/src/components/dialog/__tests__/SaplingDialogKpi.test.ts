import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingDialogKpi from '../SaplingDialogKpi.vue'

const dialogKpiMock = vi.hoisted(() => ({
  handleSelectedKpiUpdate: vi.fn(),
  handleCancel: vi.fn(),
}))

vi.mock('@/composables/dialog/useSaplingDialogKpi', () => ({
  useSaplingDialogKpi: () => ({
    formRef: ref(null),
    kpiRules: [],
    handleDialogUpdate: vi.fn(),
    handleSelectedKpiUpdate: dialogKpiMock.handleSelectedKpiUpdate,
    handleCancel: dialogKpiMock.handleCancel,
    handleSave: vi.fn(),
  }),
}))

vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({ isLoading: ref(false) }),
}))

const SingleSelectStub = defineComponent({
  name: 'SaplingFieldSingleSelect',
  props: {
    modelValue: { type: Object, default: null },
    entityHandle: { type: String, required: true },
    parentFilter: { type: Object, default: null },
    rules: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  template: '<div data-test="kpi-single-select" />',
})

const DialogCardStub = defineComponent({
  name: 'SaplingDialogCard',
  props: { close: { type: Function, required: true } },
  template: '<div><button data-test="dialog-close" @click="close()">X</button><slot /></div>',
})

const ActionSaveStub = defineComponent({
  name: 'SaplingActionSave',
  props: { cancel: { type: Function, required: true } },
  template: '<button data-test="dialog-cancel" @click="cancel()">Cancel</button>',
})

describe('SaplingDialogKpi', () => {
  beforeEach(() => {
    dialogKpiMock.handleSelectedKpiUpdate.mockClear()
    dialogKpiMock.handleCancel.mockClear()
  })

  it('uses the standard single-select field for the available KPI catalog', async () => {
    const kpis = [
      { handle: 1, name: 'Alpha', type: 'RATIO' },
      { handle: 2, name: 'Beta', type: 'ITEM' },
    ]
    const wrapper = mount(SaplingDialogKpi, {
      props: {
        addKpiDialog: true,
        excludedKpiHandles: [7, 9, 7],
        validateAndAddKpi: vi.fn(),
        closeDialog: vi.fn(),
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          VDialog: { template: '<div><slot /></div>' },
          VForm: { template: '<form><slot /></form>' },
          VSkeletonLoader: true,
          SaplingDialogCard: DialogCardStub,
          SaplingDialogHero: true,
          SaplingActionBarSkeleton: true,
          SaplingActionSave: ActionSaveStub,
          SaplingFieldSingleSelect: SingleSelectStub,
        },
      },
    })

    const singleSelect = wrapper.getComponent(SingleSelectStub)
    expect(singleSelect.props('entityHandle')).toBe('kpi')
    expect(singleSelect.props('parentFilter')).toEqual({ handle: { $nin: [7, 9] } })

    await singleSelect.vm.$emit('update:modelValue', kpis[1])
    expect(dialogKpiMock.handleSelectedKpiUpdate).toHaveBeenCalledWith(kpis[1])

    await wrapper.get('[data-test="dialog-cancel"]').trigger('click')
    await wrapper.get('[data-test="dialog-close"]').trigger('click')
    expect(dialogKpiMock.handleCancel).toHaveBeenCalledTimes(2)
  })
})
