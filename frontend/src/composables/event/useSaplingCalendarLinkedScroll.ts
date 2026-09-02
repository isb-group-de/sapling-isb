import { ref, type Ref } from 'vue'

export const CALENDAR_SCROLL_AREA_SELECTOR = [
  '.v-calendar-daily__scroll-area',
  '.v-calendar-weekly__scroll-area',
  '.v-calendar-monthly__scroll-area',
].join(', ')

/** Keeps the vertical position of side-by-side calendar bodies aligned. */
export function useSaplingCalendarLinkedScroll(linkedScrolling: Ref<boolean>) {
  const sideBySideScrollRoot = ref<HTMLElement | null>(null)
  const synchronizedTargets = new WeakSet<HTMLElement>()

  function handleCalendarScroll(event: Event) {
    if (!linkedScrolling.value) {
      return
    }

    const source = event.target
    if (
      !(source instanceof HTMLElement) ||
      !source.matches(CALENDAR_SCROLL_AREA_SELECTOR) ||
      !sideBySideScrollRoot.value?.contains(source)
    ) {
      return
    }

    if (synchronizedTargets.has(source)) {
      synchronizedTargets.delete(source)
      return
    }

    sideBySideScrollRoot.value
      .querySelectorAll<HTMLElement>(CALENDAR_SCROLL_AREA_SELECTOR)
      .forEach((target) => {
        if (target === source || target.scrollTop === source.scrollTop) {
          return
        }

        synchronizedTargets.add(target)
        target.scrollTop = source.scrollTop
      })
  }

  return {
    handleCalendarScroll,
    sideBySideScrollRoot,
  }
}
