import { describe, expect, it, vi } from 'vitest'

import { useSaplingDialogKeyboardShortcuts } from '../useSaplingDialogKeyboardShortcuts'

function createKeyboardEvent(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    cancelable: true,
    key,
    ...options,
  })
}

describe('useSaplingDialogKeyboardShortcuts', () => {
  it.each([
    ['s', { ctrlKey: true }, 'save'],
    ['Enter', { metaKey: true }, 'saveAndClose'],
    ['Escape', {}, 'cancel'],
  ] as const)('maps %s to %s', (key, options, actionName) => {
    const actions = {
      cancel: vi.fn(),
      save: vi.fn(),
      saveAndClose: vi.fn(),
    }
    const { onDialogKeydown } = useSaplingDialogKeyboardShortcuts(actions)
    const event = createKeyboardEvent(key, options)
    const stopPropagation = vi.spyOn(event, 'stopPropagation')

    onDialogKeydown(event)

    expect(actions[actionName]).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
    expect(stopPropagation).toHaveBeenCalledTimes(actionName === 'cancel' ? 1 : 0)
  })

  it('ignores repeated and alt-modified shortcuts', () => {
    const actions = {
      cancel: vi.fn(),
      save: vi.fn(),
      saveAndClose: vi.fn(),
    }
    const { onDialogKeydown } = useSaplingDialogKeyboardShortcuts(actions)

    onDialogKeydown(createKeyboardEvent('s', { ctrlKey: true, repeat: true }))
    onDialogKeydown(createKeyboardEvent('s', { ctrlKey: true, altKey: true }))
    onDialogKeydown(createKeyboardEvent('Escape', { altKey: true }))

    expect(actions.cancel).not.toHaveBeenCalled()
    expect(actions.save).not.toHaveBeenCalled()
    expect(actions.saveAndClose).not.toHaveBeenCalled()
  })
})
