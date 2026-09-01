import { describe, expect, it } from 'vitest'
import { extractClipboardImageFiles } from './markdownClipboard'

function clipboardData(options: { items?: DataTransferItem[]; files?: File[] }): DataTransfer {
  return {
    items: options.items ?? [],
    files: options.files ?? [],
  } as unknown as DataTransfer
}

function clipboardItem(file: File | null, kind: string = 'file'): DataTransferItem {
  return {
    kind,
    type: file?.type ?? 'text/plain',
    getAsFile: () => file,
  } as DataTransferItem
}

describe('extractClipboardImageFiles', () => {
  it('extracts only image file items and preserves their clipboard order', () => {
    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const ignored = new File(['text'], 'notes.txt', { type: 'text/plain' })
    const second = new File(['second'], 'second.jpg', { type: 'image/jpeg' })

    expect(
      extractClipboardImageFiles(
        clipboardData({
          items: [clipboardItem(first), clipboardItem(ignored), clipboardItem(second)],
        }),
      ),
    ).toEqual([first, second])
  })

  it('assigns a stable filename when the clipboard image has no name', () => {
    const unnamed = new File(['image'], '', { type: 'image/webp' })

    const [image] = extractClipboardImageFiles(clipboardData({ items: [clipboardItem(unnamed)] }))

    expect(image?.name).toBe('clipboard-image-1.webp')
    expect(image?.type).toBe('image/webp')
  })

  it('falls back to the clipboard file list when no file items are available', () => {
    const image = new File(['image'], 'fallback.png', { type: 'image/png' })

    expect(
      extractClipboardImageFiles(
        clipboardData({ items: [clipboardItem(null, 'string')], files: [image] }),
      ),
    ).toEqual([image])
  })
})
