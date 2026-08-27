import { addSlaHours, type SlaWorkWeek } from './sla-deadline.utils';

const weekdays: SlaWorkWeek = {
  monday: { timeFrom: '08:00', timeTo: '17:00' },
  tuesday: { timeFrom: '08:00', timeTo: '17:00' },
  wednesday: { timeFrom: '08:00', timeTo: '17:00' },
  thursday: { timeFrom: '08:00', timeTo: '17:00' },
  friday: { timeFrom: '08:00', timeTo: '17:00' },
};

describe('addSlaHours', () => {
  it('keeps elapsed-time behavior without a work week', () => {
    expect(
      addSlaHours(new Date('2026-04-27T17:00:00.000Z'), 2, {
        timeZone: 'Europe/Berlin',
      }),
    ).toEqual(new Date('2026-04-27T19:00:00.000Z'));
  });

  it('starts at the next work interval outside business hours', () => {
    expect(
      addSlaHours(new Date('2026-04-27T17:00:00.000Z'), 2, {
        workWeek: weekdays,
        timeZone: 'Europe/Berlin',
      }),
    ).toEqual(new Date('2026-04-28T08:00:00.000Z'));
  });

  it('continues across the weekend', () => {
    expect(
      addSlaHours(new Date('2026-04-24T14:00:00.000Z'), 4, {
        workWeek: weekdays,
        timeZone: 'Europe/Berlin',
      }),
    ).toEqual(new Date('2026-04-27T09:00:00.000Z'));
  });

  it('skips all-day holidays from the selected holiday calendar', () => {
    expect(
      addSlaHours(new Date('2026-04-30T14:00:00.000Z'), 4, {
        workWeek: weekdays,
        holidays: [
          {
            startDate: '2026-05-01T00:00:00.000Z',
            endDate: '2026-05-01T12:00:00.000Z',
            isAllDay: true,
          },
        ],
        timeZone: 'Europe/Berlin',
      }),
    ).toEqual(new Date('2026-05-04T09:00:00.000Z'));
  });

  it('uses the correct UTC offset after a daylight-saving transition', () => {
    expect(
      addSlaHours(new Date('2026-03-27T16:00:00.000Z'), 1, {
        workWeek: weekdays,
        timeZone: 'Europe/Berlin',
      }),
    ).toEqual(new Date('2026-03-30T07:00:00.000Z'));
  });
});
