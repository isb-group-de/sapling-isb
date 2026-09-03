import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import SaplingEventCalendar from '../SaplingEventCalendar.vue'
import { vCssVars } from '@/directives/cssVars'
import type { WorkHourWeekItem } from '@/entity/entity'

const vuetify = createVuetify({ components, directives })

describe('SaplingEventCalendar', () => {
  it('applies the selected interval height to the rendered time grid', () => {
    const wrapper = mount(SaplingEventCalendar, {
      props: {
        modelValue: '2026-09-03',
        events: [],
        calendarDisplayType: 'day',
        eventOverlapMode: 'stack',
        intervalHeight: 96,
        firstTime: 420,
        intervalCount: 11,
        workHours: null,
        showWorkHourBackground: false,
        getWorkHourStyle: () => ({}),
        getEventColor: () => '#008c95',
        getEventParticipants: () => [],
        nowY: () => '50%',
        getEvents: vi.fn(),
        openEvent: vi.fn(),
        openContextMenu: vi.fn(),
        startDrag: vi.fn(),
        startTime: vi.fn(),
        cancelDrag: vi.fn(),
        mouseMove: vi.fn(),
        endDrag: vi.fn(),
        extendBottom: vi.fn(),
      },
      global: {
        directives: { cssVars: vCssVars },
        plugins: [vuetify],
      },
    })

    const interval = wrapper.get<HTMLElement>('.v-calendar-daily__day-interval')
    expect(interval.element.style.height).toBe('96px')
    expect(wrapper.findAll('.v-calendar-daily__day-interval')).toHaveLength(11)
    expect(
      wrapper
        .get<HTMLElement>('.v-current-time')
        .element.style.getPropertyValue('--sapling-calendar-now-offset'),
    ).toBe('50%')

    wrapper.unmount()
  })

  it('renders the work-hour shading when work hours arrive after the calendar', async () => {
    const getWorkHourStyle = vi.fn(() => ({
      '--sapling-calendar-workhour-top': '33.33333333333333%',
      '--sapling-calendar-workhour-height': '37.5%',
    }))
    const wrapper = mount(SaplingEventCalendar, {
      props: {
        modelValue: '2026-09-03',
        events: [],
        calendarDisplayType: 'day',
        eventOverlapMode: 'stack',
        intervalHeight: 48,
        firstTime: 0,
        intervalCount: 24,
        workHours: null,
        showWorkHourBackground: true,
        getWorkHourStyle,
        getEventColor: () => '#008c95',
        getEventParticipants: () => [],
        nowY: () => null,
        getEvents: vi.fn(),
        openEvent: vi.fn(),
        openContextMenu: vi.fn(),
        startDrag: vi.fn(),
        startTime: vi.fn(),
        cancelDrag: vi.fn(),
        mouseMove: vi.fn(),
        endDrag: vi.fn(),
        extendBottom: vi.fn(),
      },
      global: {
        directives: { cssVars: vCssVars },
        plugins: [vuetify],
      },
    })

    expect(wrapper.find('.workhour-bg').exists()).toBe(false)

    await wrapper.setProps({
      workHours: {
        thursday: { timeFrom: '08:00', timeTo: '17:00' },
      } as unknown as WorkHourWeekItem,
    })

    const shading = wrapper.get<HTMLElement>('.workhour-bg')
    expect(getWorkHourStyle).toHaveBeenCalledWith('2026-09-03')
    expect(shading.element.style.getPropertyValue('--sapling-calendar-workhour-top')).toBe(
      '33.33333333333333%',
    )
    expect(shading.element.style.getPropertyValue('--sapling-calendar-workhour-height')).toBe(
      '37.5%',
    )

    wrapper.unmount()
  })
})
