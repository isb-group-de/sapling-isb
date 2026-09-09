import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { installMailPreviewImageInteractions } from '../saplingFileMailPreviewImages'

describe('mail preview images', () => {
  it('forces constrained images to retain their intrinsic aspect ratio', () => {
    const previewStyles = readFileSync(
      path.resolve('src/assets/styles/components/SaplingFileMailPreview.css'),
      'utf8',
    )
    expect(previewStyles).toMatch(/img\s*{[^}]*max-width:\s*100%\s*!important;/s)
    expect(previewStyles).toMatch(/img\s*{[^}]*height:\s*auto\s*!important;/s)
  })

  it('opens images with mouse and keyboard through the shared preview callback', () => {
    const previewDocument = document.implementation.createHTMLDocument('Mail')
    previewDocument.body.innerHTML =
      '<a href="https://example.test"><img src="data:image/png;base64,YQ==" alt="Screenshot"></a>'
    const image = previewDocument.querySelector('img')!
    const openImage = vi.fn()
    const cleanup = installMailPreviewImageInteractions(previewDocument, 'Preview', openImage)

    expect(image.tabIndex).toBe(0)
    expect(image.getAttribute('role')).toBe('button')
    expect(image.getAttribute('aria-haspopup')).toBe('dialog')
    expect(image.getAttribute('aria-label')).toBe('Preview: Screenshot')

    expect(image.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(
      false,
    )
    expect(openImage).toHaveBeenLastCalledWith({ src: image.src, alt: 'Screenshot' }, image)

    image.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    image.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    image.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(openImage).toHaveBeenCalledTimes(3)

    cleanup()
    image.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(openImage).toHaveBeenCalledTimes(3)
  })
})
