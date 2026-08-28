import { describe, expect, it, jest } from '@jest/globals';

import type { EventItem } from '../entity/EventItem';
import type { PersonItem } from '../entity/PersonItem';
import { replaceCalendarEventParticipants } from './calendar-participant.utils';

type EventsCollectionStub = {
  add: jest.Mock;
  init: jest.Mock;
  remove: jest.Mock;
};

function createPerson(handle: number): PersonItem & {
  events: EventsCollectionStub;
} {
  return {
    handle,
    events: {
      add: jest.fn(),
      init: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
    },
  } as unknown as PersonItem & { events: EventsCollectionStub };
}

function createEvent(
  handle: number | undefined,
  current: PersonItem[],
): EventItem & {
  participants: {
    getItems: jest.Mock;
    init: jest.Mock;
    isInitialized: jest.Mock;
    set: jest.Mock;
    setDirty: jest.Mock;
  };
} {
  return {
    handle,
    participants: {
      getItems: jest.fn(() => current),
      init: jest.fn(() => Promise.resolve()),
      isInitialized: jest.fn(() => true),
      set: jest.fn(),
      setDirty: jest.fn(),
    },
  } as unknown as EventItem & {
    participants: {
      getItems: jest.Mock;
      init: jest.Mock;
      isInitialized: jest.Mock;
      set: jest.Mock;
      setDirty: jest.Mock;
    };
  };
}

describe('replaceCalendarEventParticipants', () => {
  it('adds a participant through the owning Person.events collection', async () => {
    const owner = createPerson(7);
    const attendee = createPerson(8);
    const event = createEvent(42, [owner]);

    await replaceCalendarEventParticipants(event, [owner, attendee]);

    expect(owner.events.init).not.toHaveBeenCalled();
    expect(attendee.events.init).toHaveBeenCalledWith({
      where: { handle: 42 },
    });
    expect(attendee.events.add).toHaveBeenCalledWith(event);
    expect(event.participants.set).toHaveBeenCalledWith([owner, attendee]);
    expect(event.participants.setDirty).toHaveBeenCalledWith(false);
  });

  it('removes a stale participant through the owning collection', async () => {
    const owner = createPerson(7);
    const staleAttendee = createPerson(8);
    const event = createEvent(42, [owner, staleAttendee]);

    await replaceCalendarEventParticipants(event, [owner]);

    expect(staleAttendee.events.init).toHaveBeenCalledWith({
      where: { handle: 42 },
    });
    expect(staleAttendee.events.remove).toHaveBeenCalledWith(event);
    expect(event.participants.set).toHaveBeenCalledWith([owner]);
    expect(event.participants.setDirty).toHaveBeenCalledWith(false);
  });

  it('sets the inverse collection directly for a new event', async () => {
    const attendee = createPerson(8);
    const event = createEvent(undefined, []);

    await replaceCalendarEventParticipants(event, [attendee]);

    expect(attendee.events.init).not.toHaveBeenCalled();
    expect(attendee.events.add).not.toHaveBeenCalled();
    expect(event.participants.set).toHaveBeenCalledWith([attendee]);
    expect(event.participants.setDirty).not.toHaveBeenCalled();
  });
});
