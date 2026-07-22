import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import SaplingFormConfigPreviewPanel from '../SaplingFormConfigPreviewPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'company.name': 'Name',
        'formConfig.livePreview': 'Live preview',
        'formConfig.preview': 'Preview',
        'formConfig.previewForm': 'Form',
        'formConfig.previewTable': 'Table',
        'formConfig.previewMobileTable': 'Mobile table',
        'formConfig.required': 'Required',
        'formConfig.optional': 'Optional',
        'navigation.company': 'Companies',
      })[key] ?? key,
    te: (key: string) => ['company.name', 'navigation.company'].includes(key),
  }),
}))

const templates = [
  {
    key: 'name',
    name: 'name',
    type: 'string',
    formGroup: 'company.groupBasics',
    formGroupOrder: 100,
    formOrder: 100,
    formWidth: 2,
    formVisible: true,
    tableVisible: true,
    tableOrder: 100,
    mobileVisible: true,
    mobileOrder: 100,
    isRequired: true,
  },
  {
    key: 'description',
    name: 'description',
    type: 'string',
    formGroup: 'company.groupDetails',
    formGroupOrder: 200,
    formOrder: 100,
    formWidth: 4,
    formVisible: true,
    tableVisible: false,
    mobileVisible: false,
  },
] satisfies EntityTemplate[]

const groups = [
  { key: 'company.groupBasics', label: 'Basics', visible: true, order: 100 },
  { key: 'company.groupDetails', label: 'Details', visible: true, order: 200 },
  { key: 'company.groupEmpty', label: 'Empty group', visible: true, order: 300 },
]

function mountPreview(previewMode: 'form' | 'table' | 'mobile') {
  return mount(SaplingFormConfigPreviewPanel, {
    props: {
      selectedEntityHandle: 'company',
      draftTemplates: templates,
      groups,
      previewMode,
      reloadDisabled: false,
    },
    global: {
      stubs: {
        SaplingSurface: {
          props: ['as'],
          template: '<component :is="as || \'div\'"><slot /></component>',
        },
        VBtn: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        VChip: { template: '<span><slot /></span>' },
        VIcon: { template: '<i />' },
      },
    },
  })
}

function mockPreviewBounds(element: HTMLElement, bottom = 400) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom,
    height: bottom,
    left: 100,
    right: 500,
    top: 0,
    width: 400,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  })
}

function mockScrollableElement(element: HTMLElement, initialScrollTop = 0, maximumScrollTop = 200) {
  let scrollTop = initialScrollTop
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 200 },
    scrollHeight: { configurable: true, value: 200 + maximumScrollTop },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = Math.min(maximumScrollTop, Math.max(0, value))
      },
    },
  })
  element.style.overflowY = 'auto'
  return () => scrollTop
}

function createPointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
): Event {
  return new MouseEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX,
    clientY,
  })
}

describe('SaplingFormConfigPreviewPanel', () => {
  it('keeps all preview tabs rendered and emits explicit mode changes', async () => {
    const wrapper = mountPreview('form')
    const tabs = wrapper.findAll('[role="tab"]')

    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.text())).toEqual(['Form', 'Table', 'Mobile table'])

    await tabs[1]?.trigger('click')
    expect(wrapper.emitted('update:previewMode')).toEqual([['table']])
  })

  it('renders group structure and field names with friendly types', () => {
    const wrapper = mountPreview('form')

    expect(wrapper.text()).toContain('Basics')
    expect(wrapper.text()).toContain('company.groupBasics')
    expect(wrapper.text()).toContain('Name (Short Text)')
    expect(wrapper.text()).toContain('name · Required')
  })

  it('shows an exact field drop preview and emits the target group', async () => {
    const wrapper = mountPreview('form')
    const field = wrapper.get('[data-preview-field="name"]')
    const targetGrid = wrapper
      .get('[data-preview-group="company.groupDetails"]')
      .get('.sapling-form-config-preview__grid')

    const previewScroller = wrapper.get('.sapling-form-config-preview').element as HTMLElement
    mockPreviewBounds(previewScroller)
    const getScrollTop = mockScrollableElement(previewScroller)

    field.element.dispatchEvent(createPointerEvent('pointerdown', 200, 100))
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    await wrapper.vm.$nextTick()
    expect(field.classes()).toContain('sapling-form-config-preview__field--layout-hidden')

    window.dispatchEvent(
      new WheelEvent('wheel', { cancelable: true, clientX: 200, clientY: 200, deltaY: 80 }),
    )
    expect(getScrollTop()).toBe(80)

    targetGrid.element.dispatchEvent(createPointerEvent('pointermove', 200, 200))
    await wrapper.vm.$nextTick()

    const dropPreview = wrapper.get('.sapling-form-config-preview__field-drop-preview')
    dropPreview.element.dispatchEvent(createPointerEvent('pointermove', 200, 200))

    window.dispatchEvent(createPointerEvent('pointerup', 200, 200))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('moveField')).toEqual([['name', 'company.groupDetails', null]])
  })

  it('uses the visible clipped edge and continues through nested scroll containers', async () => {
    const wrapper = mountPreview('form')
    const previewScroller = wrapper.get('.sapling-form-config-preview').element as HTMLElement
    mockPreviewBounds(previewScroller)
    const getPreviewScrollTop = mockScrollableElement(previewScroller, 190, 200)
    const outerScroller = previewScroller.parentElement?.parentElement as HTMLElement
    vi.spyOn(outerScroller, 'getBoundingClientRect').mockReturnValue({
      bottom: 250,
      height: 250,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const getOuterScrollTop = mockScrollableElement(outerScroller, 0, 200)

    wrapper
      .get('[data-preview-field="name"]')
      .element.dispatchEvent(createPointerEvent('pointerdown', 200, 100))
    window.dispatchEvent(createPointerEvent('pointermove', 200, 245))
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
    )

    expect(getPreviewScrollTop()).toBe(200)
    expect(getOuterScrollTop()).toBeGreaterThan(0)

    window.dispatchEvent(createPointerEvent('pointerup', 10, 10))
    wrapper.unmount()
  })

  it('clears drag state when the browser loses the pointer lifecycle', async () => {
    const wrapper = mountPreview('form')
    const field = wrapper.get('[data-preview-field="name"]')

    field.element.dispatchEvent(createPointerEvent('pointerdown', 200, 100))
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    await wrapper.vm.$nextTick()
    expect(field.classes()).toContain('sapling-form-config-preview__field--layout-hidden')

    window.dispatchEvent(new Event('blur'))
    await wrapper.vm.$nextTick()

    expect(field.classes()).not.toContain('sapling-form-config-preview__field--layout-hidden')
    expect(field.classes()).not.toContain('sapling-form-config-preview__field--drag-source')
  })

  it('clears drag state when the item is released outside the preview', async () => {
    const wrapper = mountPreview('form')
    const field = wrapper.get('[data-preview-field="name"]')

    const previewScroller = wrapper.get('.sapling-form-config-preview').element as HTMLElement
    mockPreviewBounds(previewScroller)
    field.element.dispatchEvent(createPointerEvent('pointerdown', 200, 100))
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    await wrapper.vm.$nextTick()

    window.dispatchEvent(createPointerEvent('pointerup', 10, 10))
    await wrapper.vm.$nextTick()

    expect(field.classes()).not.toContain('sapling-form-config-preview__field--layout-hidden')
    expect(field.classes()).not.toContain('sapling-form-config-preview__field--drag-source')
  })

  it('shows empty groups only during a field drag and accepts them as drop targets', async () => {
    const wrapper = mountPreview('form')

    expect(wrapper.find('[data-preview-group="company.groupEmpty"]').exists()).toBe(false)

    const previewScroller = wrapper.get('.sapling-form-config-preview').element as HTMLElement
    mockPreviewBounds(previewScroller)
    wrapper
      .get('[data-preview-field="name"]')
      .element.dispatchEvent(createPointerEvent('pointerdown', 200, 100))
    await wrapper.vm.$nextTick()

    const emptyGroup = wrapper.get('[data-preview-group="company.groupEmpty"]')
    const targetGrid = emptyGroup.get('.sapling-form-config-preview__grid')
    expect(emptyGroup.text()).toContain('Empty group')
    expect(targetGrid.find('.sapling-form-config-preview__empty-field-target').exists()).toBe(true)

    targetGrid.element.dispatchEvent(createPointerEvent('pointermove', 200, 200))
    window.dispatchEvent(createPointerEvent('pointerup', 200, 200))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('moveField')).toEqual([['name', 'company.groupEmpty', null]])
  })

  it('previews and emits group insertion positions', async () => {
    const wrapper = mountPreview('form')
    const sourceGroup = wrapper.get('[data-preview-group="company.groupBasics"]')
    const targetGroup = wrapper.get('[data-preview-group="company.groupDetails"]')
    const previewScroller = wrapper.get('.sapling-form-config-preview').element as HTMLElement
    mockPreviewBounds(previewScroller)

    sourceGroup
      .get('.sapling-form-config-preview__drag-handle')
      .element.dispatchEvent(createPointerEvent('pointerdown', 200, 100))
    targetGroup.element.dispatchEvent(createPointerEvent('pointermove', 200, -1))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.sapling-form-config-preview__group-drop-preview').exists()).toBe(true)

    window.dispatchEvent(createPointerEvent('pointerup', 200, 200))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('reorderGroup')).toEqual([
      ['company.groupBasics', 'company.groupDetails', 'before'],
    ])
  })

  it('shows field structure without sample values in table and mobile modes', () => {
    const table = mountPreview('table')
    const mobile = mountPreview('mobile')

    expect(table.text()).toContain('Name')
    expect(table.text()).toContain('Short Text')
    expect(table.find('tbody').exists()).toBe(false)
    expect(mobile.text()).toContain('Name')
    expect(mobile.text()).toContain('Short Text')
    expect(`${table.text()} ${mobile.text()}`).not.toContain('true')
  })
})
