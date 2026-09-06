import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { CalendarClickMode } from '../eventCalendarPreferences'
import { useSaplingCalendarClicks } from '../useSaplingCalendarClicks'

const slot = { date: '2026-09-07', year: 2026, month: 9, day: 7, hour: 9, minute: 0 }
const event = { start: 1, end: 2, timed: true } as CalendarEvent
const mouse = (detail = 1, y = 0, buttons = 1) =>
  new MouseEvent('mousedown', { detail, clientY: y, buttons })

function harness(open: CalendarClickMode, create: CalendarClickMode, drag: CalendarClickMode) {
  const options = {
    openClickMode: () => open,
    createClickMode: () => create,
    dragClickMode: () => drag,
    openEvent: vi.fn(),
    startDrag: vi.fn(),
    startTime: vi.fn(),
    mouseMove: vi.fn(),
    endDrag: vi.fn(),
    cancelDrag: vi.fn(),
  }
  let clicks!: ReturnType<typeof useSaplingCalendarClicks>
  const wrapper = mount(
    defineComponent({
      setup() {
        clicks = useSaplingCalendarClicks(options)
        return () => null
      },
    }),
  )
  return { clicks, options, wrapper }
}

afterEach(() => vi.useRealTimers())

const modes: CalendarClickMode[] = ['single', 'double']
describe('calendar click preferences', () => {
  it.each(
    modes.flatMap((open) => modes.flatMap((create) => modes.map((drag) => [open, create, drag]))),
  )('keeps open=%s, create=%s and drag=%s independent', (open, create, drag) => {
    vi.useFakeTimers()
    const h = harness(open, create, drag)
    h.clicks.eventClick(mouse(1), event)
    vi.runAllTimers()
    expect(h.options.openEvent).toHaveBeenCalledTimes(open === 'single' ? 1 : 0)
    h.clicks.eventClick(mouse(2), event)
    vi.runAllTimers()
    expect(h.options.openEvent).toHaveBeenCalled()

    h.clicks.timeMouseDown(mouse(1), slot)
    h.clicks.timeMouseUp(mouse(1))
    vi.runAllTimers()
    expect(h.options.startTime).toHaveBeenCalledTimes(create === 'single' ? 1 : 0)
    h.options.startTime.mockClear()
    h.options.endDrag.mockClear()
    h.clicks.timeMouseDown(mouse(drag === 'double' ? 2 : 1), slot)
    h.clicks.timeMouseMove(mouse(1, 10), { ...slot, minute: 30 })
    h.clicks.timeMouseUp(mouse(1, 10))
    expect(h.options.startTime).toHaveBeenCalledTimes(1)
    expect(h.options.mouseMove).toHaveBeenCalledTimes(1)
    expect(h.options.endDrag).toHaveBeenCalledTimes(1)
    h.wrapper.unmount()
  })

  it('does not capture a drag snapshot for a normal event click', () => {
    const h = harness('single', 'single', 'single')
    h.clicks.eventDown(mouse(), { event, timed: true })
    h.clicks.timeMouseDown(mouse(), slot)
    h.clicks.timeMouseUp(mouse())
    h.clicks.eventClick(mouse(), event)
    expect(h.options.startDrag).not.toHaveBeenCalled()
    expect(h.options.startTime).not.toHaveBeenCalled()
    expect(h.options.openEvent).toHaveBeenCalledTimes(1)
    h.wrapper.unmount()
  })

  it('cancels a delayed opening when the second press becomes a drag', () => {
    vi.useFakeTimers()
    const h = harness('single', 'single', 'double')
    h.clicks.eventClick(mouse(), event)
    expect(h.options.openEvent).not.toHaveBeenCalled()
    h.clicks.eventDown(mouse(2), { event, timed: true })
    h.clicks.timeMouseDown(mouse(2), slot)
    h.clicks.timeMouseMove(mouse(2, 20), { ...slot, minute: 30 })
    h.clicks.timeMouseUp(mouse(2, 20))
    h.clicks.eventClick(mouse(2), event)
    vi.runAllTimers()
    expect(h.options.startDrag).toHaveBeenCalledTimes(1)
    expect(h.options.endDrag).toHaveBeenCalledTimes(1)
    expect(h.options.openEvent).not.toHaveBeenCalled()
    h.wrapper.unmount()
  })

  it('does not create a draft when a disallowed first-press drag moves across empty space', () => {
    const h = harness('double', 'single', 'double')
    h.clicks.timeMouseDown(mouse(), slot)
    h.clicks.timeMouseMove(mouse(1, 20), slot)
    h.clicks.timeMouseUp(mouse())
    expect(h.options.startTime).not.toHaveBeenCalled()
    h.wrapper.unmount()
  })

  it('requires the second press for resizing and cancels active gestures on unmount', () => {
    const h = harness('single', 'single', 'double')
    const resize = vi.fn()
    h.clicks.beginResize(mouse(), resize)
    expect(resize).not.toHaveBeenCalled()
    h.clicks.beginResize(mouse(2), resize)
    expect(resize).toHaveBeenCalledTimes(1)
    h.wrapper.unmount()
    expect(h.options.cancelDrag).toHaveBeenCalledTimes(1)
  })
})
