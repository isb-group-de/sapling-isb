import { SystemAlertIncidentItem } from '../../../entity/SystemAlertIncidentItem';
import { SystemAlertRuleItem } from '../../../entity/SystemAlertRuleItem';
import { SystemAlertService } from './system-alert.service';

describe('SystemAlertService', () => {
  it('normalizes bigint-generated incident handles before the next flush', async () => {
    const rule = Object.assign(new SystemAlertRuleItem(), {
      handle: 'cpu-warning',
      title: 'CPU warning',
      metricKey: 'host.cpu.percent',
      severity: 'warning' as const,
      comparator: 'gt' as const,
      threshold: 85,
      windowSeconds: 300,
      minimumCount: 1,
      scope: 'global',
      isActive: true,
    });
    let createdIncident: SystemAlertIncidentItem | undefined;
    const execute = jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('pg_try_advisory_xact_lock')
          ? [{ locked: true }]
          : [{ dimension: '', value: 90, count: 30 }],
      ),
    );
    const em = {
      find: jest.fn(async (entity: unknown) =>
        entity === SystemAlertRuleItem ? [rule] : [],
      ),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, data: object) => {
        createdIncident = Object.assign(new SystemAlertIncidentItem(), data);
        return createdIncident;
      }),
      flush: jest.fn(async () => {
        if (createdIncident?.handle == null) {
          (createdIncident as { handle?: number | string }).handle = '1';
        }
      }),
      getConnection: () => ({ execute }),
      transactional: (callback: (transaction: unknown) => unknown) =>
        callback(em),
      getReference: jest.fn((_entity: unknown, handle: string) => ({ handle })),
    };
    const notifications = {
      notifyOpened: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SystemAlertService(
      { fork: () => em } as never,
      notifications as never,
      { getIgnoredFilesystemDimensions: () => [] } as never,
      { currentId: 'test' } as never,
      { execute: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await service.evaluate();

    expect(createdIncident?.handle).toBe(1);
    expect(notifications.notifyOpened).toHaveBeenCalledWith(createdIncident);
    expect(em.flush).toHaveBeenCalledTimes(2);
  });

  it('opens one person-scoped incident for roleless authentication attempts', async () => {
    const rule = Object.assign(new SystemAlertRuleItem(), {
      handle: 'roleless-authentication',
      title: 'Roleless account authentication',
      metricKey: 'auth.rolelessAttempts',
      severity: 'warning' as const,
      comparator: 'gt' as const,
      threshold: 0,
      windowSeconds: 300,
      minimumCount: 1,
      scope: 'user',
      isActive: true,
    });
    let createdIncident: SystemAlertIncidentItem | undefined;
    const execute = jest.fn((sql: string) => {
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve([{ locked: true }]);
      }
      expect(sql).toContain('not exists');
      expect(sql).toContain('"person_item_roles"');
      return Promise.resolve([
        {
          dimension: '4810',
          value: 2,
          count: 2,
          diagnosis: {
            personHandle: 4810,
            personName: 'Example Person',
            eventTypes: ['loginFailure', 'loginSuccess'],
            providers: ['local'],
          },
        },
      ]);
    });
    const em = {
      find: jest.fn(async (entity: unknown) =>
        entity === SystemAlertRuleItem ? [rule] : [],
      ),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, data: object) => {
        createdIncident = Object.assign(new SystemAlertIncidentItem(), data, {
          handle: 12,
        });
        return createdIncident;
      }),
      flush: jest.fn().mockResolvedValue(undefined),
      getConnection: () => ({ execute }),
      transactional: (callback: (transaction: unknown) => unknown) =>
        callback(em),
    };
    const notifications = {
      notifyOpened: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SystemAlertService(
      { fork: () => em } as never,
      notifications as never,
      { getIgnoredFilesystemDimensions: () => [] } as never,
      { currentId: 'test' } as never,
      { execute: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await service.evaluate();

    expect(createdIncident).toEqual(
      expect.objectContaining({
        fingerprint: 'roleless-authentication:4810',
        dimensionKey: '4810',
        observedValue: 2,
        diagnosis: expect.objectContaining({
          personName: 'Example Person',
          eventTypes: ['loginFailure', 'loginSuccess'],
        }),
      }),
    );
    expect(notifications.notifyOpened).toHaveBeenCalledTimes(1);
  });
});
