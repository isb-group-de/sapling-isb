import { flushPromises, shallowMount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '@/entity/entity'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import SaplingDashboardWidgets from '../SaplingDashboardWidgets.vue'
import SaplingDashboardWidgetCard from '../SaplingDashboardWidgetCard.vue'
import SaplingDialogDelete from '@/components/dialog/SaplingDialogDelete.vue'

const api = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('@/services/api.generic.service', () => ({ default: api }))
vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({ isLoading: ref(false) }),
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const widgets: DashboardWidget[] = [
  { id: 'value', title: 'Value', kind: 'KPI', columns: 1, rows: 1, config: { kpiHandle: 7 } },
  {
    id: 'site',
    title: 'Site',
    kind: 'WEBSITE',
    columns: 1,
    rows: 2,
    config: { url: 'https://example.com', mode: 'link' },
  },
]
const button = defineComponent({ template: '<button><slot /></button>' })
const global = {
  renderStubDefaultSlot: true,
  mocks: { $t: (key: string) => key },
  stubs: {
    SaplingDialogDelete: false,
    SaplingDialogConfirm: { template: '<div><slot name="actions" /></div>' },
    SaplingActionBar: { template: '<div><slot name="leading" /><slot name="trailing" /></div>' },
    'v-btn': button,
    'v-icon': true,
  },
}

describe('dashboard widget actions', () => {
  beforeEach(() => {
    api.update.mockReset()
    api.update.mockResolvedValue({})
  })

  it.each([true, false])(
    'removes the confirmed widget when layoutEditing is %s',
    async (layoutEditing) => {
      const wrapper = shallowMount(SaplingDashboardWidgets, {
        props: { dashboard: { handle: 3, widgets } as DashboardItem, layoutEditing },
        global,
      })
      await wrapper.findAllComponents(SaplingDashboardWidgetCard)[0]!.vm.$emit('remove')
      const dialog = wrapper.getComponent(SaplingDialogDelete)
      expect(dialog.props('modelValue')).toBe(true)
      // Use the real confirmation component: it closes before emitting confirm.
      await dialog
        .findAll('button')
        .find((entry) => entry.text() === 'global.delete')!
        .trigger('click')
      await flushPromises()
      expect(wrapper.emitted('update:widgets')).toEqual([[[widgets[1]]]])
      expect(dialog.props('modelValue')).toBe(false)
      expect(api.update.mock.calls).toEqual(
        layoutEditing ? [] : [['dashboard', 3, { widgets: [widgets[1]] }]],
      )
      wrapper.unmount()
    },
  )

  it('keeps widgets when deletion is cancelled', async () => {
    const wrapper = shallowMount(SaplingDashboardWidgets, {
      props: { dashboard: { handle: 3, widgets } as DashboardItem, layoutEditing: true },
      global,
    })
    await wrapper.findAllComponents(SaplingDashboardWidgetCard)[0]!.vm.$emit('remove')
    const dialog = wrapper.getComponent(SaplingDialogDelete)
    await dialog
      .findAll('button')
      .find((entry) => entry.text() === 'global.cancel')!
      .trigger('click')
    expect(dialog.props('modelValue')).toBe(false)
    expect(wrapper.emitted('update:widgets')).toBeUndefined()
    expect(api.update).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['link', 'embed'] as const)('opens website actions in a new tab in %s mode', (mode) => {
    const widget: DashboardWidget = {
      ...widgets[1]!,
      kind: 'WEBSITE',
      config: { url: 'https://example.com', mode },
    }
    const wrapper = shallowMount(SaplingDashboardWidgetCard, {
      props: { widget, editing: false },
      global,
    })
    const links = wrapper.findAll('[href="https://example.com"]')
    expect(links).toHaveLength(mode === 'link' ? 2 : 1)
    for (const link of links) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
    wrapper.unmount()
  })
})
