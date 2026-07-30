import { describe, expect, it, jest } from '@jest/globals';

import { GoogleCalendarService } from './google.calendar.service';
import { EventGoogleItem } from '../../entity/EventGoogleItem';
import { EventItem } from '../../entity/EventItem';

type GoogleDeliveryServiceTestHarness = {
  updateEvent: (
    calendar: object,
    event: EventItem,
    reference: EventGoogleItem,
    accessToken: string,
    classificationMappings: [],
    operation: 'remove-recurrence',
  ) => Promise<unknown>;
};

describe('GoogleCalendarService recurrence materialization', () => {
  it('clears the existing series master with one focused update', async () => {
    const patch = jest.fn((_request: object) =>
      Promise.resolve({ data: { id: 'google-1', recurrence: [] } }),
    );
    const service = new GoogleCalendarService(
      {} as never,
      {} as never,
    ) as unknown as GoogleDeliveryServiceTestHarness;

    await service.updateEvent(
      { events: { patch } },
      { handle: 42 } as EventItem,
      { referenceHandle: 'google-1' } as EventGoogleItem,
      'access-token',
      [],
      'remove-recurrence',
    );

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith({
      calendarId: 'primary',
      eventId: 'google-1',
      requestBody: { recurrence: [] },
      auth: 'access-token',
    });
  });
});
