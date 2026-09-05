import { mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import SaplingChangeLogDetailValue from './SaplingChangeLogDetailValue.vue'

vi.mock('@/components/dialog/SaplingDialogEditFieldRenderer.vue', () => ({
  default: {
    name: 'SaplingDialogEditFieldRenderer',
    props: ['formValues'],
    template: '<div />',
  },
}))

describe('read-only merge and history datetime values', () => {
  beforeAll(() => vi.stubEnv('TZ', 'Europe/Berlin'))
  afterAll(() => vi.unstubAllEnvs())

  it.each([
    ['2026-01-09T08:00:00.000Z', '2026-01-09', '09:00'],
    ['2026-07-09T08:00:00.000Z', '2026-07-09', '10:00'],
    ['2026-01-09T23:30:00.000Z', '2026-01-10', '00:30'],
    ['2026-01-09T08:00:00-05:00', '2026-01-09', '14:00'],
  ])('renders %s in the same local timezone as the edit form', (value, date, time) => {
    const payload = { startsAt: value }
    const wrapper = mount(SaplingChangeLogDetailValue, {
      props: {
        entityHandle: 'ticket',
        template: { key: 'ticket.startsAt', name: 'startsAt', type: 'datetime' },
        value,
        payload,
      },
    })
    expect(
      wrapper.getComponent({ name: 'SaplingDialogEditFieldRenderer' }).props('formValues'),
    ).toEqual({ startsAt: value, startsAt_date: date, startsAt_time: time })
    expect(payload).toEqual({ startsAt: value })
    wrapper.unmount()
  })
})
