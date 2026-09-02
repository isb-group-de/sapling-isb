import type { ObjectDirective } from 'vue'

export type SaplingCssVariables = Record<`--${string}`, string | number | null | undefined>

const appliedVariables = new WeakMap<HTMLElement, Set<string>>()

export function setCssVariables(element: HTMLElement, variables: SaplingCssVariables) {
  for (const [name, value] of Object.entries(variables)) {
    if (!name.startsWith('--')) continue

    if (value === null || value === undefined || value === '') {
      element.style.removeProperty(name)
    } else {
      element.style.setProperty(name, String(value))
    }
  }
}

function applyCssVariables(element: HTMLElement, variables: SaplingCssVariables | undefined) {
  const previousVariables = appliedVariables.get(element) ?? new Set<string>()
  const nextVariables = new Set<string>()

  for (const name of Object.keys(variables ?? {}))
    if (name.startsWith('--')) nextVariables.add(name)
  setCssVariables(element, variables ?? {})

  for (const name of previousVariables) {
    if (!nextVariables.has(name)) element.style.removeProperty(name)
  }

  appliedVariables.set(element, nextVariables)
}

export const vCssVars: ObjectDirective<HTMLElement, SaplingCssVariables | undefined> = {
  mounted(element, binding) {
    applyCssVariables(element, binding.value)
  },
  updated(element, binding) {
    applyCssVariables(element, binding.value)
  },
  beforeUnmount(element) {
    for (const name of appliedVariables.get(element) ?? []) element.style.removeProperty(name)
    appliedVariables.delete(element)
  },
}
