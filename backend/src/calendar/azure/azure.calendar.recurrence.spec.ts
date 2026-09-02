import { describe, expect, it, jest } from '@jest/globals';
import { EventItem } from '../../entity/EventItem';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { PersonItem } from '../../entity/PersonItem';
import { AzureCalendarService } from './azure.calendar.service';
import type {
  AzureCategoryServiceTestHarness,
  AzureDeliveryServiceTestHarness,
} from './azure.calendar.service.spec-support';

describe('AzureCalendarService Outlook master categories', () => {
  it('loads, normalizes, and sorts the current user categories', async () => {
    const session = { handle: 5 };
    const em = {
      fork: () => em,
      findOne: jest.fn(() => Promise.resolve(session)),
    };
    const service = new AzureCalendarService({} as never, em as never);
    const harness = service as unknown as AzureCategoryServiceTestHarness;
    harness.resolveAzureAccessToken = jest.fn(() =>
      Promise.resolve('access-token'),
    );
    harness.fetchMasterCategoriesWithRetry = jest.fn(() =>
      Promise.resolve([
        { id: '2', displayName: ' Vertrieb ', color: ' preset7 ' },
        { id: '1', displayName: 'Projekt', color: 'preset4' },
        { id: '3', displayName: ' ' },
      ]),
    );

    await expect(
      service.getMasterCategories({
        handle: 7,
        type: { handle: 'azure' },
      } as unknown as PersonItem),
    ).resolves.toEqual([
      { id: '1', displayName: 'Projekt', color: 'preset4' },
      { id: '2', displayName: 'Vertrieb', color: 'preset7' },
    ]);
    expect(harness.fetchMasterCategoriesWithRetry).toHaveBeenCalledWith(
      session,
      'access-token',
    );
  });
});

describe('AzureCalendarService recurrence materialization', () => {
  it('clears the existing series master with one focused update', async () => {
    const patch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce({ id: 'outlook-1', recurrence: null });
    const api = jest
      .fn<(_path: string) => { patch: typeof patch }>()
      .mockReturnValue({ patch });
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureDeliveryServiceTestHarness;
    const event = {
      handle: 42,
      title: 'Planning',
      startDate: new Date('2026-07-28T11:00:00.000Z'),
      endDate: new Date('2026-07-28T12:00:00.000Z'),
      recurrenceRule: null,
      participants: [],
      type: { handle: 'appointment' },
    } as unknown as EventItem;
    const reference = { referenceHandle: 'outlook-1' } as EventAzureItem;

    await service.updateEvent(
      { api },
      event,
      reference,
      { persist: jest.fn(), flush: jest.fn() },
      [],
      'remove-recurrence',
    );

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenNthCalledWith(1, '/me/events/outlook-1');
    expect(patch).toHaveBeenNthCalledWith(1, {
      start: { dateTime: '2026-07-28T11:00:00.000Z', timeZone: 'UTC' },
      end: { dateTime: '2026-07-28T12:00:00.000Z', timeZone: 'UTC' },
      recurrence: null,
    });
  });

  it('deletes exactly the matching Outlook series instance', async () => {
    const get = jest.fn(() =>
      Promise.resolve({
        value: [
          {
            id: 'occurrence-2',
            type: 'occurrence',
            originalStart: '2026-07-29T11:00:00.0000000',
            start: { dateTime: '2026-07-29T11:00:00.0000000' },
          },
        ],
      }),
    );
    const remove = jest.fn(() => Promise.resolve(undefined));
    const query = jest.fn(() => ({ header: jest.fn(() => ({ get })) }));
    const api = jest.fn((path: string) =>
      path.endsWith('/instances') ? { query } : { delete: remove },
    );
    const service = new AzureCalendarService(
      {} as never,
      {} as never,
    ) as unknown as AzureDeliveryServiceTestHarness;

    await expect(
      service.detachOccurrence(
        { api },
        { referenceHandle: 'outlook-master' },
        '2026-07-29T11:00:00.000Z',
      ),
    ).resolves.toEqual({ success: true, detachedOccurrenceId: 'occurrence-2' });

    expect(api).toHaveBeenNthCalledWith(
      1,
      '/me/events/outlook-master/instances',
    );
    expect(api).toHaveBeenNthCalledWith(2, '/me/events/occurrence-2');
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
