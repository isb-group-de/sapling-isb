import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingDialogKpi from '../SaplingDialogKpi.vue'

const dialogKpiMock = vi.hoisted(() => ({
  handleSelectedKpiUpdate: vi.fn(),
}))

vi.mock('@/composables/dialog/useSaplingDialogKpi', () => ({
  useSaplingDialogKpi: () => ({
    formRef: ref(null),
    kpiRules: [],
    handleDialogUpdate: vi.fn(),
    handleSelectedKpiUpdate: dialogKpiMock.handleSelectedKpiUpdate,
    handleCancel: vi.fn(),
    handleSave: vi.fn(),
  }),
}))

vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({ isLoading: ref(false) }),
}))

const VAutocompleteStub = defineComponent({
  name: 'VAutocomplete',
  props: {
    modelValue: { type: Object, default: null },
    items: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  template: '<div data-test="kpi-autocomplete" />',
})

describe('SaplingDialogKpi', () => {
  beforeEach(() => {
    dialogKpiMock.handleSelectedKpiUpdate.mockClear()
  })

  it('uses a searchable autocomplete for the available KPI catalog', async () => {
    const availableKpis = [
      { handle: 1, name: 'Alpha' },
      { handle: 2, name: 'Beta' },
    ]
    const wrapper = mount(SaplingDialogKpi, {
      props: {
        addKpiDialog: true,
        availableKpis: availableKpis as never,
        validateAndAddKpi: vi.fn(),
        closeDialog: vi.fn(),
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          VDialog: { template: '<div><slot /></div>' },
          VForm: { template: '<form><slot /></form>' },
          VAutocomplete: VAutocompleteStub,
          VSkeletonLoader: true,
          SaplingDialogCard: { template: '<div><slot /></div>' },
          SaplingDialogHero: true,
          SaplingActionBarSkeleton: true,
          SaplingActionSave: true,
        },
      },
    })

    const autocomplete = wrapper.getComponent(VAutocompleteStub)
    expect(autocomplete.props('items')).toEqual(availableKpis)

    await autocomplete.vm.$emit('update:modelValue', availableKpis[1])
    expect(dialogKpiMock.handleSelectedKpiUpdate).toHaveBeenCalledWith(availableKpis[1])
  })
})
