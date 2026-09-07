import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Client } from '@microsoft/microsoft-graph-client';
import axios from 'axios';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { EventCategoryItem } from '../../entity/EventCategoryItem';
import { EventStatusItem } from '../../entity/EventStatusItem';
import { EventTypeItem } from '../../entity/EventTypeItem';
import { PersonItem } from '../../entity/PersonItem';
import { PersonSessionItem } from '../../entity/PersonSessionItem';
import { AzureCalendarService } from './azure.calendar.service';

class ImportService extends AzureCalendarService {
  readonly graphRead =
    jest.fn<(token: string, path: string) => Promise<unknown>>();

  protected override createClient(token: string): Client {
    return {
      api: (path: string) => {
        const request = {
          query: () => request,
          header: () => request,
          get: () => this.graphRead(token, path),
        };
        return request;
      },
    } as unknown as Client;
  }
}

const expiredTokenError = () =>
  Object.assign(
    new Error('Lifetime validation failed, the token is expired.'),
    {
      statusCode: 401,
      code: 'InvalidAuthenticationToken',
    },
  );

function setup() {
  const user = {
    handle: 7,
    type: { handle: 'azure' },
    company: { handle: 42 },
  } as PersonItem;
  const session = {
    handle: 5,
    accessToken: 'expired-access',
    refreshToken: 'refresh-token',
  } as PersonSessionItem;
  const event = {
    startDate: new Date('2099-01-01T10:00:00Z'),
    endDate: new Date('2099-01-01T11:00:00Z'),
    status: { handle: 'scheduled' },
    participants: [user],
  };
  const em = {
    findOne: jest.fn(async (entity: unknown, filter: unknown) => {
      if (entity === PersonSessionItem) return session;
      if (entity === PersonItem) return user;
      if (entity === EventStatusItem) return filter;
      return null;
    }),
    find: jest.fn(async (entity: unknown) => {
      if (entity === EventTypeItem) return [{ handle: 'online' }];
      if (entity === EventCategoryItem) return [{ handle: 'internal' }];
      if (entity === EventAzureItem) {
        return [{ referenceHandle: 'missing-event', event }];
      }
      return [];
    }),
    flush: jest.fn(async () => undefined),
  };
  const service = new ImportService({} as never, { fork: () => em } as never);
  const runImport = () =>
    service.importEvents(user, {
      startDateTime: new Date('2099-01-01T00:00:00Z'),
      endDateTime: new Date('2099-01-02T00:00:00Z'),
    });
  const refresh = jest.spyOn(axios, 'post').mockResolvedValue({
    data: { access_token: 'fresh-access', refresh_token: 'rotated-refresh' },
  });
  const missingEvent = Object.assign(new Error('Not found'), {
    statusCode: 404,
  });
  return { service, session, event, em, runImport, refresh, missingEvent };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Azure calendar import token refresh', () => {
  it('uses the refreshed token for reconciliation after calendarView rejects the old token', async () => {
    const { service, session, event, em, runImport, refresh, missingEvent } =
      setup();
    service.graphRead.mockImplementation(async (token, path) => {
      if (token === 'expired-access') throw expiredTokenError();
      if (path === '/me/calendarView') return { value: [] };
      throw missingEvent;
    });

    await expect(runImport()).resolves.toEqual({
      imported: 1,
      created: 0,
      updated: 1,
      skipped: 0,
    });
    expect(service.graphRead.mock.calls).toEqual([
      ['expired-access', '/me/calendarView'],
      ['fresh-access', '/me/calendarView'],
      ['fresh-access', '/me/events/missing-event'],
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    const params = new URLSearchParams(refresh.mock.calls[0]?.[1] as string);
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('refresh-token');
    expect(session.accessToken).toBe('fresh-access');
    expect(session.refreshToken).toBe('rotated-refresh');
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(event.status.handle).toBe('completed');
  });

  it('refreshes once when the token expires during reconciliation', async () => {
    const { service, runImport, refresh, missingEvent } = setup();
    service.graphRead.mockImplementation(async (token, path) => {
      if (path === '/me/calendarView') return { value: [] };
      if (token === 'expired-access') throw expiredTokenError();
      throw missingEvent;
    });

    await expect(runImport()).resolves.toMatchObject({ updated: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(service.graphRead.mock.calls.slice(1)).toEqual([
      ['expired-access', '/me/events/missing-event'],
      ['fresh-access', '/me/events/missing-event'],
    ]);
  });

  it('preserves the refresh token when Microsoft does not return a replacement', async () => {
    const { service, session, runImport, refresh, missingEvent } = setup();
    refresh.mockResolvedValue({ data: { access_token: 'fresh-access' } });
    service.graphRead.mockImplementation(async (token, path) => {
      if (token === 'expired-access') throw expiredTokenError();
      if (path === '/me/calendarView') return { value: [] };
      throw missingEvent;
    });

    await runImport();
    expect(session.refreshToken).toBe('refresh-token');
  });

  it('does not retry indefinitely or reconcile events after a repeated authentication failure', async () => {
    const { service, event, em, runImport, refresh } = setup();
    const failure = expiredTokenError();
    service.graphRead.mockImplementation(async (_token, path) => {
      if (path === '/me/calendarView') return { value: [] };
      throw failure;
    });

    await expect(runImport()).rejects.toBe(failure);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(service.graphRead).toHaveBeenCalledTimes(3);
    expect(event.status.handle).toBe('scheduled');
    expect(event.participants).toHaveLength(1);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('does not refresh on an unrelated Graph server failure', async () => {
    const { service, runImport, refresh, event } = setup();
    const failure = Object.assign(new Error('Graph unavailable'), {
      statusCode: 500,
    });
    service.graphRead.mockImplementation(async (_token, path) => {
      if (path === '/me/calendarView') return { value: [] };
      throw failure;
    });

    await expect(runImport()).rejects.toBe(failure);
    expect(refresh).not.toHaveBeenCalled();
    expect(event.status.handle).toBe('scheduled');
  });

  it('leaves events unchanged if no refresh token is available', async () => {
    const { service, session, event, runImport, refresh } = setup();
    session.refreshToken = '';
    const failure = expiredTokenError();
    service.graphRead.mockImplementation(async (_token, path) => {
      if (path === '/me/calendarView') return { value: [] };
      throw failure;
    });

    await expect(runImport()).rejects.toBe(failure);
    expect(refresh).not.toHaveBeenCalled();
    expect(event.status.handle).toBe('scheduled');
  });
});
