import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

export function useSaplingFieldDropdownFocus(menuOpen: Ref<boolean>) {
  const fieldRootRef = ref<HTMLElement | null>(null)
  const menuSurfaceRef = ref<HTMLElement | null>(null)
  let deferredFocusCheck: ReturnType<typeof setTimeout> | null = null

  function isWithinFieldBoundary(target: Node): boolean {
    return (
      fieldRootRef.value?.contains(target) === true ||
      menuSurfaceRef.value?.contains(target) === true
    )
  }

  function isOwnedOverlay(overlay: Element, visited = new Set<Element>()): boolean {
    if (visited.has(overlay)) {
      return false
    }
    visited.add(overlay)

    const overlayId = overlay.id
    if (!overlayId) {
      return false
    }

    const activators = Array.from(document.querySelectorAll<HTMLElement>('[aria-controls]')).filter(
      (activator) => activator.getAttribute('aria-controls') === overlayId,
    )

    return activators.some((activator) => {
      if (isWithinFieldBoundary(activator)) {
        return true
      }

      const parentOverlay = activator.closest<HTMLElement>('.v-overlay[id]')
      return parentOverlay ? isOwnedOverlay(parentOverlay, visited) : false
    })
  }

  function isWithinOwnedOverlay(target: Node): boolean {
    const element = target instanceof Element ? target : target.parentElement
    const overlay = element?.closest<HTMLElement>('.v-overlay[id]')
    return overlay ? isOwnedOverlay(overlay) : false
  }

  function containsTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Node &&
      (isWithinFieldBoundary(target) || isWithinOwnedOverlay(target))
    )
  }

  function closeMenu(): void {
    menuOpen.value = false
  }

  function closeMenuOnTab(): void {
    closeMenu()
  }

  function closeMenuOnEscape(event: KeyboardEvent): void {
    if (!menuOpen.value) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    closeMenu()
    void nextTick(() => {
      fieldRootRef.value
        ?.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), [role="combobox"], button:not([disabled])',
        )
        ?.focus({ preventScroll: true })
    })
  }

  function getMenuRows(): HTMLElement[] {
    return Array.from(
      menuSurfaceRef.value?.querySelectorAll<HTMLElement>('.sapling-table-row') ?? [],
    )
  }

  async function focusFirstMenuRow(): Promise<void> {
    if (!menuOpen.value) {
      menuOpen.value = true
    }
    await nextTick()
    getMenuRows()[0]?.focus({ preventScroll: true })
  }

  function moveMenuRowFocus(direction: 1 | -1): void {
    const rows = getMenuRows()
    if (rows.length === 0) {
      return
    }

    const activeIndex = rows.findIndex((row) => row === document.activeElement)
    const nextIndex =
      activeIndex < 0
        ? direction > 0
          ? 0
          : rows.length - 1
        : (activeIndex + direction + rows.length) % rows.length
    rows[nextIndex]?.focus({ preventScroll: true })
  }

  function closeMenuWhenFocusLeaves(event: FocusEvent): void {
    if (containsTarget(event.relatedTarget)) {
      return
    }

    if (deferredFocusCheck) {
      clearTimeout(deferredFocusCheck)
    }
    deferredFocusCheck = setTimeout(() => {
      deferredFocusCheck = null
      if (!containsTarget(document.activeElement)) {
        closeMenu()
      }
    }, 0)
  }

  onBeforeUnmount(() => {
    if (deferredFocusCheck) {
      clearTimeout(deferredFocusCheck)
    }
  })

  return {
    fieldRootRef,
    menuSurfaceRef,
    closeMenu,
    closeMenuOnTab,
    closeMenuOnEscape,
    closeMenuWhenFocusLeaves,
    focusFirstMenuRow,
    moveMenuRowFocus,
  }
}
