import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import { vCssVars } from '@/directives/cssVars'
import SaplingEventAgendaPanel from '../SaplingEventAgendaPanel.vue'

describe('SaplingEventAgendaPanel', () => {
  it('maps the event type to the card tint and the category to the left accent', () => {
    const wrapper = shallowMount(SaplingEventAgendaPanel, {
      props: {
        upcomingEvents: [
          {
            key: '42-occurrence',
            title: 'Planning',
            dateLabel: '11.09.2026',
            timeLabel: '09:00 - 10:00',
            onlineMeetingUrl: null,
            participantNames: [],
            icon: 'mdi-lifebuoy',
            typeColor: '#673AB7',
            categoryColor: '#009688',
            isOngoing: false,
            isRecurring: false,
            calendarEvent: {
              start: 1,
              end: 2,
              timed: true,
            } as CalendarEvent,
          },
        ],
      },
      global: {
        directives: { cssVars: vCssVars },
        mocks: { $t: (key: string) => key },
        stubs: {
          SaplingSurface: { template: '<section><slot /></section>' },
          SaplingEventOnlineMeetingLink: true,
          'v-icon': true,
        },
      },
    })

    const item = wrapper.get<HTMLElement>('.sapling-event-agenda-item')
    expect(item.element.style.getPropertyValue('--sapling-calendar-event-card-color')).toBe(
      '#673AB7',
    )
    expect(item.element.style.getPropertyValue('--sapling-calendar-event-category-color')).toBe(
      '#009688',
    )
  })
})
