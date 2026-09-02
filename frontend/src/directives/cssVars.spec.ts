import { describe, expect, it } from 'vitest'
import type { DirectiveBinding } from 'vue'
import { vCssVars, type SaplingCssVariables } from './cssVars'

function binding(value: SaplingCssVariables | undefined) {
  return { value } as DirectiveBinding<SaplingCssVariables | undefined>
}

describe('vCssVars', () => {
  it('applies, updates, and removes only CSS custom properties', () => {
    const element = document.createElement('div')

    vCssVars.mounted?.(
      element,
      binding({ '--sapling-test-color': '#123456', '--sapling-test-size': 12 }),
      {} as never,
      null,
    )
    expect(element.style.getPropertyValue('--sapling-test-color')).toBe('#123456')
    expect(element.style.getPropertyValue('--sapling-test-size')).toBe('12')

    vCssVars.updated?.(
      element,
      binding({ '--sapling-test-color': '#abcdef' }),
      {} as never,
      {} as never,
    )
    expect(element.style.getPropertyValue('--sapling-test-color')).toBe('#abcdef')
    expect(element.style.getPropertyValue('--sapling-test-size')).toBe('')

    vCssVars.beforeUnmount?.(element, binding(undefined), {} as never, null)
    expect(element.getAttribute('style')).toBe('')
  })
})
