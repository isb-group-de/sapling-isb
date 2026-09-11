import { readFileSync } from 'node:fs'
import path from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingMarkdownContent from '../SaplingMarkdownContent.vue'

function mountMarkdown(source: string) {
  return mount(SaplingMarkdownContent, {
    props: { source },
    attrs: { class: 'existing-consumer-style' },
    global: { stubs: { SaplingImagePreviewDialog: true } },
  })
}

describe('Markdown image previews', () => {
  it('keeps preview text selectable inside the non-selectable app shell', () => {
    const markdownStyles = readFileSync(
      path.resolve('src/assets/styles/framework/SaplingFrameworkMarkdown.css'),
      'utf8',
    )
    const previewRule = markdownStyles.match(/\.sapling-markdown-preview\s*{(?<body>[^}]*)}/s)

    expect(previewRule?.groups?.body).toMatch(/(?:^|\s)user-select:\s*text;/)
    expect(previewRule?.groups?.body).toMatch(/-moz-user-select:\s*text;/)
  })

  it('matches the preview copy action to its button height', () => {
    const markdownStyles = readFileSync(
      path.resolve('src/assets/styles/framework/SaplingFrameworkMarkdown.css'),
      'utf8',
    )
    const copyActionRule = markdownStyles.match(
      /\.sapling-markdown-pane__copy-action\s*{(?<body>[^}]*)}/s,
    )

    expect(copyActionRule?.groups?.body).toMatch(/width:\s*var\(--v-btn-height\);/)
    expect(copyActionRule?.groups?.body).toMatch(/height:\s*var\(--v-btn-height\);/)
  })

  it.each([
    '![Screenshot](/image.png)',
    '[![Screenshot](/image.png)](/destination)',
    '{{sapling-image:373|Screenshot}}',
    '![Screenshot](sapling-document:373)',
  ])('opens only the rendered image for %s', async (source) => {
    const wrapper = mountMarkdown(source)
    const image = wrapper.get('img')
    expect(wrapper.get('.sapling-markdown-content').classes()).toContain('existing-consumer-style')
    expect(image.attributes('tabindex')).toBe('0')
    expect(image.attributes('aria-haspopup')).toBe('dialog')
    await image.trigger('click')
    await flushPromises()
    const dialog = wrapper.getComponent({ name: 'SaplingImagePreviewDialog' })
    expect(dialog.attributes('src')).toBe(image.element.src)
    expect(dialog.attributes('alt')).toBe('Screenshot')
    dialog.vm.$emit('close')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'SaplingImagePreviewDialog' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('supports keyboard activation and closes stale previews when the source changes', async () => {
    const wrapper = mountMarkdown('![Screenshot](/image.png)')
    await wrapper.get('img').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'SaplingImagePreviewDialog' }).exists()).toBe(true)
    await wrapper.setProps({ source: '![Other](/other.png)' })
    expect(wrapper.findComponent({ name: 'SaplingImagePreviewDialog' }).exists()).toBe(false)
    await wrapper.get('img').trigger('keydown', { key: ' ' })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'SaplingImagePreviewDialog' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('leaves Markdown source in code blocks and ordinary links alone', async () => {
    const wrapper = mountMarkdown('`![Screenshot](/image.png)`\n\n[Document](/document.pdf)')
    await wrapper.get('code').trigger('click')
    wrapper.get('a').element.addEventListener('click', (event) => event.preventDefault())
    await wrapper.get('a').trigger('click')
    expect(wrapper.findComponent({ name: 'SaplingImagePreviewDialog' }).exists()).toBe(false)
    wrapper.unmount()
  })
})
