import { expect, it, jest } from '@jest/globals';
import {
  hasSaplingOption,
  ENTITY_REGISTRY,
  GenericTimelineService,
  createTemplateField,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService timeline workflows', () => {
  it('bounds timeline record payloads to the requested months', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    ENTITY_REGISTRY.splice(0, ENTITY_REGISTRY.length, {
      name: 'ticket',
    } as never);

    const findOne = jest
      .fn<() => Promise<Record<string, unknown> | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        handle: 7,
        firstName: 'Ada',
        createdAt: new Date('2026-04-10T12:00:00.000Z'),
        updatedAt: new Date('2026-04-10T12:00:00.000Z'),
      })
      .mockResolvedValueOnce(null);
    const timelineRecords = [
      {
        handle: 101,
        title: 'April ticket',
        assigneePerson: { handle: 7 },
        isEscalated: true,
        occurredAt: new Date('2026-04-12T09:00:00.000Z'),
      },
      {
        handle: 102,
        title: 'March ticket',
        assigneePerson: { handle: 7 },
        isEscalated: false,
        occurredAt: new Date('2026-03-05T09:00:00.000Z'),
      },
    ];
    const find = jest.fn((...args: unknown[]) => {
      const options = args[2] as { limit?: number } | undefined;
      return Promise.resolve(
        options?.limit === 1 ? [{ handle: 99 }] : timelineRecords,
      );
    });
    const em = {
      findOne,
      find,
    };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        switch (entityHandle) {
          case 'person':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'firstName', type: 'string' }),
              createTemplateField({ name: 'createdAt', type: 'date' }),
              createTemplateField({ name: 'updatedAt', type: 'date' }),
            ];
          case 'ticket':
            return [
              createTemplateField({ name: 'handle', type: 'number' }),
              createTemplateField({ name: 'title', type: 'string' }),
              createTemplateField({
                name: 'occurredAt',
                type: 'datetime',
                options: ['isOrderDESC'],
              }),
              createTemplateField({
                name: 'assigneePerson',
                isReference: true,
                kind: 'm:1',
                referenceName: 'person',
                options: ['isPerson'],
              }),
              createTemplateField({
                name: 'isEscalated',
                type: 'boolean',
              }),
            ];
          default:
            return [];
        }
      }),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({
        allowRead: true,
        allowReadStage: 'global',
      })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const scriptService = {
      runServer: jest.fn((_method: unknown, items: unknown) =>
        Promise.resolve({
          items,
        }),
      ),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
      scriptService,
    });

    const result = await service.getRecordTimeline(
      'person',
      7,
      { handle: 7 } as unknown as never,
      '2026-04',
      2,
    );

    expect(find).toHaveBeenCalledTimes(2);
    const recordQuery = find.mock.calls.find(
      (call) => (call[2] as { limit?: number } | undefined)?.limit !== 1,
    );
    const olderRecordQuery = find.mock.calls.find(
      (call) => (call[2] as { limit?: number } | undefined)?.limit === 1,
    );
    expect(JSON.stringify(recordQuery?.[1])).toContain('$lte');
    expect(JSON.stringify(recordQuery?.[1])).toContain('$gte');
    expect(JSON.stringify(olderRecordQuery?.[1])).toContain('$lt');
    expect(JSON.stringify(recordQuery?.[1])).toContain('occurredAt');
    expect(JSON.stringify(recordQuery?.[1])).not.toContain('createdAt');
    expect(JSON.stringify(recordQuery?.[1])).not.toContain('updatedAt');
    expect(recordQuery?.[2]).toEqual(
      expect.objectContaining({ orderBy: { occurredAt: 'DESC' } }),
    );
    expect(result.months).toHaveLength(2);
    expect(result.months.map((month) => month.key)).toEqual([
      '2026-04',
      '2026-03',
    ]);
    expect(result.months[0]?.entities[0]?.count).toBe(1);
    expect(result.months[1]?.entities[0]?.count).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextBefore).toBe('2026-02');

    ENTITY_REGISTRY.splice(0, ENTITY_REGISTRY.length);
  });

  it('reuses a lone creation timestamp as both timeline boundaries', () => {
    const timelineService = new GenericTimelineService(
      { getEntityTemplate: jest.fn(() => []) } as never,
      { getEntityPermissions: jest.fn() } as never,
    );

    expect(
      timelineService.getTimelineDateFieldConfig([
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'createdAt', type: 'datetime' }),
      ]),
    ).toEqual({
      startFieldName: 'createdAt',
      endFieldName: 'createdAt',
      startFallbackFieldName: 'createdAt',
      endFallbackFieldName: 'createdAt',
    });
  });

  it('builds table-friendly timeline drilldown filters for primary date fields', () => {
    const templateService = {
      getEntityTemplate: jest.fn(() => []),
    };
    const currentService = {
      getEntityPermissions: jest.fn(),
    };
    const timelineService = new GenericTimelineService(
      templateService as never,
      currentService as never,
    );
    const monthWindow = timelineService.createTimelineMonthWindow(
      new Date(2026, 6, 1),
    );
    const monthEndExclusive = new Date(monthWindow.end.getTime() + 1);
    const month = timelineService.buildTimelineMonth(
      [
        {
          descriptor: {
            entityHandle: 'event',
            template: [],
            relationFields: [
              createTemplateField({
                name: 'creatorCompany',
                isReference: true,
                kind: 'm:1',
                referenceName: 'company',
              }),
            ],
            relationCategory: null,
            dateFields: {
              startFieldName: 'startDate',
              endFieldName: 'endDate',
              startFallbackFieldName: 'createdAt',
              endFallbackFieldName: 'updatedAt',
            },
            chipFields: [],
            booleanFields: [
              createTemplateField({
                name: 'isAllDay',
                type: 'boolean',
              }),
            ],
            moneyField: null,
          },
          relationFilter: {
            creatorCompany: 4,
          },
          records: [
            {
              handle: 101,
              creatorCompany: 4,
              startDate: new Date(2026, 6, 6, 9),
              endDate: new Date(2026, 6, 11, 17),
              isAllDay: true,
              createdAt: new Date(2026, 0, 1),
              updatedAt: new Date(2026, 0, 2),
            },
          ],
        },
      ],
      monthWindow,
    );

    expect(month.entities[0]?.startFilter).toEqual({
      $and: [
        { creatorCompany: 4 },
        {
          startDate: {
            $gte: monthWindow.start,
            $lt: monthEndExclusive,
          },
        },
      ],
    });
    expect(month.entities[0]?.endFilter).toEqual({
      $and: [
        { creatorCompany: 4 },
        {
          endDate: {
            $gte: monthWindow.start,
            $lt: monthEndExclusive,
          },
        },
      ],
    });
    expect(month.entities[0]?.groups[0]?.items[0]?.drilldownFilter).toEqual({
      $and: [
        {
          $and: [
            { creatorCompany: 4 },
            {
              $and: [
                {
                  startDate: {
                    $lt: monthEndExclusive,
                  },
                },
                {
                  endDate: {
                    $gte: monthWindow.start,
                  },
                },
              ],
            },
          ],
        },
        { isAllDay: true },
      ],
    });
    expect(
      JSON.stringify(month.entities[0]?.groups[0]?.items[0]?.drilldownFilter),
    ).not.toContain('createdAt');
    expect(
      JSON.stringify(month.entities[0]?.groups[0]?.items[0]?.drilldownFilter),
    ).not.toContain('updatedAt');
  });
});
