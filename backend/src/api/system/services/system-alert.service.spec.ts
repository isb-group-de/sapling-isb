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
    const execute = jest
      .fn()
      .mockResolvedValue([{ dimension: '', value: 90, count: 30 }]);
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
    };
    const notifications = {
      notifyOpened: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SystemAlertService(
      { fork: () => em } as never,
      notifications as never,
      { getIgnoredFilesystemDimensions: () => [] } as never,
    );

    await service.evaluate();

    expect(createdIncident?.handle).toBe(1);
    expect(notifications.notifyOpened).toHaveBeenCalledWith(createdIncident);
    expect(em.flush).toHaveBeenCalledTimes(2);
  });
});
