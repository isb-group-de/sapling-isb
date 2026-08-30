import { describe, expect, it, jest } from '@jest/globals';
import {
  normalizeGoogleRecurrence,
  resolveGoogleSeriesImportEvents,
} from './google-calendar.utils';

describe('google-calendar.utils', () => {
  it('collapses expanded recurring instances to one loaded series master', async () => {
    const loadMaster = jest.fn(async (id: string) => ({
      id,
      summary: 'Series master',
      recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
    }));

    await expect(
      resolveGoogleSeriesImportEvents(
        [
          { id: 'single-1', summary: 'Single' },
          { id: 'instance-1', recurringEventId: 'master-1' },
          { id: 'instance-2', recurringEventId: 'master-1' },
        ],
        loadMaster,
      ),
    ).resolves.toEqual([
      { id: 'single-1', summary: 'Single' },
      {
        id: 'master-1',
        summary: 'Series master',
        recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
      },
    ]);
    expect(loadMaster).toHaveBeenCalledTimes(1);
  });

  it('normalizes RRULE and EXDATE lines from a Google series master', () => {
    expect(
      normalizeGoogleRecurrence([
        'RRULE:FREQ=DAILY;COUNT=3',
        'EXDATE:20260729T110000Z',
      ]),
    ).toEqual({
      recurrenceRule: 'FREQ=DAILY;COUNT=3',
      exceptionDates: ['2026-07-29T11:00:00.000Z'],
    });
  });
});
