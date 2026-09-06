import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import SaplingEventToolbar from '../SaplingEventToolbar.vue'

const vuetify = createVuetify({ components, directives })
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      global: {
        more: 'More',
        next: 'Next',
        previous: 'Previous',
        refresh: 'Refresh',
      },
      event: { today: 'Today' },
      calendar: {
        openRecord: 'Open record',
        createAppointment: 'Create appointment',
        dragAppointments: 'Drag and resize',
        singleClick: 'Single click',
        doubleClick: 'Double click',
        combined: 'Combined',
        day: 'Day',
        extended: 'Extended',
        month: 'Month',
        overlapColumns: 'Appointments side by side',
        overlapStack: 'Stack appointments',
        selectDate: 'Select date',
        sideBySide: 'Side by side',
        standard: 'Standard',
        timeGridHeight: 'Time grid height',
        timeGridHeightDouble: 'Double height',
        timeGridHeightStandard: 'Standard height',
        timeRange: 'Displayed time range',
        timeRangeFullDay: 'Full day',
        timeRangeWorkHours: 'My working hours',
        week: 'Week',
        workweek: 'Workweek',
      },
    },
  },
})

describe('SaplingEventToolbar', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    })

    Object.defineProperty(globalThis, 'visualViewport', {
      configurable: true,
      value: {
        addEventListener: () => undefined,
        height: 768,
        offsetLeft: 0,
        offsetTop: 0,
        removeEventListener: () => undefined,
        scale: 1,
        width: 1024,
      },
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the time-grid height selector in the overflow menu and emits changes', async () => {
    const wrapper = mount(SaplingEventToolbar, {
      attachTo: document.body,
      props: {
        isNarrowScreen: false,
        calendarType: 'week',
        calendarTypeOptions: ['day', 'workweek', 'week', 'month'],
        calendarViewMode: 'single',
        calendarMode: 'default',
        eventOverlapMode: 'stack',
        linkedScrolling: true,
        timeGridScale: 'standard',
        timeRangeMode: 'fullDay',
        modelValue: '2026-09-03',
        isRefreshing: false,
        isSyncingExternalCalendar: false,
        calendarSyncProvider: null,
        periodLabel: 'September 2026',
        periodRangeLabel: '31 Aug – 6 Sep 2026',
        periodIcon: 'mdi-calendar-month-outline',
      },
      global: { plugins: [vuetify, i18n] },
    })

    await wrapper.get('[aria-label="More"]').trigger('click')
    await nextTick()

    const menu = document.querySelector<HTMLElement>('.sapling-event-toolbar__overflow-menu')
    expect(menu?.textContent).toContain('Time grid height')
    expect(menu?.textContent).toContain('Standard height')
    expect(menu?.textContent).toContain('Double height')
    expect(menu?.textContent).toContain('Displayed time range')
    expect(menu?.textContent).toContain('Full day')
    expect(menu?.textContent).toContain('My working hours')

    const doubleHeightItem = Array.from(
      menu?.querySelectorAll<HTMLElement>('.v-list-item') ?? [],
    ).find((item) => item.textContent?.includes('Double height'))
    expect(doubleHeightItem).toBeDefined()

    doubleHeightItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('update:timeGridScale')).toEqual([['double']])

    const workHoursItem = Array.from(
      menu?.querySelectorAll<HTMLElement>('.v-list-item') ?? [],
    ).find((item) => item.textContent?.includes('My working hours'))
    workHoursItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('update:timeRangeMode')).toEqual([['workHours']])
    for (const [label, model] of [
      ['Open record', 'openClickMode'],
      ['Create appointment', 'createClickMode'],
      ['Drag and resize', 'dragClickMode'],
    ]) {
      const toggle = menu?.querySelector(`[aria-label="${label}"]`)
      const button = Array.from(toggle?.querySelectorAll('button') ?? []).find((button) =>
        button.textContent?.includes('Double click'),
      )
      expect(button).toBeDefined()
      button?.click()
      await nextTick()
      expect(wrapper.emitted(`update:${model}`)).toEqual([['double']])
    }
    wrapper.unmount()
  })
})
