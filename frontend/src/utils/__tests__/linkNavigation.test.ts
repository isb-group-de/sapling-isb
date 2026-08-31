import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installGlobalModifiedLinkNavigation,
  prepareModifiedLinkForNewTab,
} from '../linkNavigation'

function createLink(href = '/target') {
  const link = document.createElement('a')
  link.href = href
  link.textContent = 'Ziel'
  document.body.append(link)
  return link
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('linkNavigation', () => {
  it('leaves normal link clicks to the browser', () => {
    const link = createLink()
    const event = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    Object.defineProperty(event, 'target', { value: link })

    expect(prepareModifiedLinkForNewTab(event)).toBe(false)
    expect(event.defaultPrevented).toBe(false)
    expect(link.hasAttribute('target')).toBe(false)
  })

  it.each([
    ['Ctrl-click', { button: 0, ctrlKey: true }],
    ['Cmd-click', { button: 0, metaKey: true }],
    ['middle-click', { button: 1 }],
  ])('opens %s in a new tab', (_label, eventInit) => {
    vi.useFakeTimers()
    const link = createLink('/target')
    const event = new MouseEvent('click', { ...eventInit, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: link })

    expect(prepareModifiedLinkForNewTab(event)).toBe(true)
    expect(event.defaultPrevented).toBe(false)
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer')

    vi.runAllTimers()
    expect(link.hasAttribute('target')).toBe(false)
  })

  it('handles modifier clicks through the installed global listener', () => {
    const remove = installGlobalModifiedLinkNavigation()
    const link = createLink('/target')

    link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1, cancelable: true }))

    expect(link.target).toBe('_blank')
    remove()
  })

  it('ignores downloads and links with an explicit target', () => {
    const link = createLink('/target')
    link.target = '_blank'
    const event = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      ctrlKey: true,
      cancelable: true,
    })
    Object.defineProperty(event, 'target', { value: link })

    expect(prepareModifiedLinkForNewTab(event)).toBe(false)
  })
})
