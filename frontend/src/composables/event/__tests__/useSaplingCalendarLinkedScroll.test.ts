import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useSaplingCalendarLinkedScroll } from '../useSaplingCalendarLinkedScroll'

function createCalendarScrollArea(scrollTop = 0) {
  const element = document.createElement('div')
  element.className = 'v-calendar-weekly__scroll-area'
  element.scrollTop = scrollTop
  return element
}

describe('useSaplingCalendarLinkedScroll', () => {
  it('copies a user scroll position to every other calendar column', () => {
    const linkedScrolling = ref(true)
    const linkedScroll = useSaplingCalendarLinkedScroll(linkedScrolling)
    const root = document.createElement('div')
    const first = createCalendarScrollArea(420)
    const second = createCalendarScrollArea(100)
    const third = createCalendarScrollArea(0)
    root.append(first, second, third)
    linkedScroll.sideBySideScrollRoot.value = root

    linkedScroll.handleCalendarScroll({ target: first } as unknown as Event)

    expect(second.scrollTop).toBe(420)
    expect(third.scrollTop).toBe(420)
  })

  it('leaves calendar columns independent when linked scrolling is disabled', () => {
    const linkedScrolling = ref(false)
    const linkedScroll = useSaplingCalendarLinkedScroll(linkedScrolling)
    const root = document.createElement('div')
    const source = createCalendarScrollArea(360)
    const target = createCalendarScrollArea(80)
    root.append(source, target)
    linkedScroll.sideBySideScrollRoot.value = root

    linkedScroll.handleCalendarScroll({ target: source } as unknown as Event)

    expect(target.scrollTop).toBe(80)
  })

  it('ignores scroll events outside the calendar bodies', () => {
    const linkedScroll = useSaplingCalendarLinkedScroll(ref(true))
    const root = document.createElement('div')
    const calendar = createCalendarScrollArea(50)
    const unrelated = document.createElement('div')
    unrelated.scrollTop = 200
    root.append(calendar, unrelated)
    linkedScroll.sideBySideScrollRoot.value = root

    linkedScroll.handleCalendarScroll({ target: unrelated } as unknown as Event)

    expect(calendar.scrollTop).toBe(50)
  })
})
