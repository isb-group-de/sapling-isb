import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SaplingMarkdownPreviewPane from './SaplingMarkdownPreviewPane.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const VBtnStub = {
  inheritAttrs: false,
  props: {
    ariaLabel: String,
    disabled: Boolean,
    icon: String,
    title: String,
  },
  emits: ['click'],
  template: `
    <button
      v-bind="$attrs"
      :aria-label="ariaLabel"
      :disabled="disabled"
      :data-icon="icon"
      :title="title"
      @click="$emit('click')"
    ><slot /></button>
  `,
}

function mountPane(options: { disabled?: boolean; previewValue?: string } = {}) {
  return mount(SaplingMarkdownPreviewPane, {
    props: {
      showPreview: true,
      disabled: options.disabled ?? false,
      previewValue: options.previewValue ?? '# Heading\n\n**Rendered text**',
      isEnhancedEditorReady: true,
      refreshPreviewLabel: 'Aktualisieren',
    },
    global: {
      stubs: {
        VBtn: VBtnStub,
        SaplingMarkdownContent: {
          template: '<article><h1>Heading</h1><p>Rendered text</p></article>',
        },
      },
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('SaplingMarkdownPreviewPane', () => {
  it('copies the rendered preview text without Markdown syntax', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mountPane()
    const copyButton = wrapper.get('[data-test="markdown-copy-preview"]')

    expect(copyButton.classes()).toContain('sapling-markdown-pane__copy-action')
    await copyButton.trigger('click')

    expect(writeText).toHaveBeenCalledWith('HeadingRendered text')
    expect(writeText).not.toHaveBeenCalledWith('# Heading\n\n**Rendered text**')
  })

  it('keeps copying available when editing is disabled', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    })
    const wrapper = mountPane({ disabled: true })

    expect(
      wrapper.get('[data-test="markdown-copy-preview"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('disables copying when the preview is empty', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    })
    const wrapper = mountPane({ previewValue: '   ' })

    expect(wrapper.get('[data-test="markdown-copy-preview"]').attributes('disabled')).toBeDefined()
  })
})
