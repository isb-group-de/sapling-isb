import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SaplingFieldTablePicker from '../SaplingFieldTablePicker.vue'

const originalInnerWidth = window.innerWidth
const originalInnerHeight = window.innerHeight
const originalVisualViewport = window.visualViewport

const VMenuStub = defineComponent({
  name: 'VMenu',
  props: {
    modelValue: Boolean,
    width: String,
    maxWidth: String,
    maxHeight: String,
    location: String,
    offset: Number,
    scrollStrategy: String,
  },
  template:
    '<div data-test="table-picker-menu"><slot name="activator" :props="{}" /><slot /></div>',
})

const SaplingDialogStub = defineComponent({
  name: 'SaplingDialog',
  props: { modelValue: Boolean, fullscreen: Boolean },
  template:
    '<div data-test="table-picker-dialog"><slot name="activator" :props="{}" /><slot /></div>',
})

const SaplingDialogCardStub = defineComponent({
  name: 'SaplingDialogCard',
  template: '<div><slot /></div>',
})

const SaplingDialogShellStub = defineComponent({
  name: 'SaplingDialogShell',
  template: '<div><slot name="hero" /><slot name="body" /></div>',
})

const SaplingDialogHeroStub = defineComponent({
  name: 'SaplingDialogHero',
  props: { eyebrow: String, title: String },
  template: '<div />',
})

const SaplingTextFieldStub = defineComponent({
  name: 'SaplingTextField',
  props: { modelValue: String },
  emits: ['update:modelValue'],
  template: '<input data-test="fullscreen-search" />',
})

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
}

function mountPicker(modelValue = false) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { global: { select: 'Select' } } },
  })

  return mount(SaplingFieldTablePicker, {
    props: {
      label: 'Company',
      searchValue: '',
      modelValue,
    },
    slots: {
      activator: ({ props }: { props: Record<string, unknown> }) =>
        h('button', { ...props, 'data-test': 'picker-activator' }),
      default: '<button class="sapling-table-row">Result</button>',
    },
    global: {
      plugins: [i18n],
      stubs: {
        'v-menu': VMenuStub,
        SaplingDialog: SaplingDialogStub,
        SaplingDialogCard: SaplingDialogCardStub,
        SaplingDialogShell: SaplingDialogShellStub,
        SaplingDialogHero: SaplingDialogHeroStub,
        SaplingTextField: SaplingTextFieldStub,
      },
    },
  })
}

function setActivatorBox(
  wrapper: ReturnType<typeof mountPicker>,
  box: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>,
) {
  const activator = wrapper.get('.sapling-field-table-picker__activator').element
  activator.getBoundingClientRect = () =>
    ({
      x: box.left,
      y: box.top,
      toJSON: () => ({}),
      ...box,
    }) as DOMRect
}

beforeEach(() => setViewport(1200, 800))

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  })
})

describe('SaplingFieldTablePicker', () => {
  it('opens above the field when only the upper side has usable space', async () => {
    const wrapper = mountPicker()
    setActivatorBox(wrapper, {
      top: 650,
      bottom: 700,
      left: 200,
      right: 500,
      width: 300,
      height: 50,
    })

    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect(wrapper.getComponent(VMenuStub).props()).toMatchObject({
      location: 'top start',
      maxHeight: '400px',
      offset: 4,
      scrollStrategy: 'reposition',
    })
  })

  it('caps a dropdown to the usable space below its field', async () => {
    setViewport(1200, 620)
    const wrapper = mountPicker()
    setActivatorBox(wrapper, {
      top: 300,
      bottom: 350,
      left: 200,
      right: 500,
      width: 300,
      height: 50,
    })

    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect(wrapper.getComponent(VMenuStub).props()).toMatchObject({
      location: 'bottom start',
      maxHeight: '250px',
    })
  })

  it('uses the full-screen picker when neither vertical side is usable', async () => {
    setViewport(1200, 500)
    const wrapper = mountPicker()
    setActivatorBox(wrapper, {
      top: 220,
      bottom: 270,
      left: 200,
      right: 500,
      width: 300,
      height: 50,
    })

    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect(wrapper.findComponent(VMenuStub).exists()).toBe(false)
    expect(wrapper.getComponent(SaplingDialogStub).props()).toMatchObject({
      modelValue: true,
      fullscreen: true,
    })
  })

  it('uses the full-screen picker at mobile widths and exposes its own search', async () => {
    setViewport(480, 800)
    const wrapper = mountPicker(true)
    await nextTick()

    expect(wrapper.findComponent(VMenuStub).exists()).toBe(false)
    expect(wrapper.getComponent(SaplingDialogStub).props('fullscreen')).toBe(true)

    await wrapper.getComponent(SaplingTextFieldStub).vm.$emit('update:modelValue', 'Sapling')

    expect(wrapper.emitted('update:search')).toEqual([['Sapling']])
  })

  it('keeps click activation available for picker consumers that need it', async () => {
    setViewport(480, 800)
    const wrapper = mountPicker(false)
    await wrapper.setProps({ openOnClick: true })
    await nextTick()

    await wrapper.get('[data-test="picker-activator"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })
})
