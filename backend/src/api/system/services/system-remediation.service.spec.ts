import { BadRequestException } from '@nestjs/common';
import { SystemRemediationService } from './system-remediation.service';

describe('SystemRemediationService', () => {
  it('allows only explicitly safe actions and verifies recovery three times', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ handle: 4 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ handle: 4, state: 'succeeded' }]);
    const checks = {
      runAll: jest.fn().mockResolvedValue([
        {
          checkKey: 'telemetry.collector',
          category: 'telemetry',
          status: 'healthy',
          durationMs: 0,
        },
        {
          checkKey: 'frontend.experience',
          category: 'frontend',
          status: 'unknown',
          durationMs: 0,
        },
      ]),
    };
    const collector = {
      collect: jest.fn().mockResolvedValue(undefined),
      getStatus: () => ({ lastSampleAt: new Date().toISOString() }),
    };
    const service = new SystemRemediationService(
      { fork: () => ({ getConnection: () => ({ execute }) }) } as never,
      {
        currentId: 'test',
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
      collector as never,
      checks as never,
    );

    await expect(
      service.execute({
        actionKey: 'shell.execute',
        mode: 'approved',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.execute({
        actionKey: 'telemetry.recover',
        incidentHandle: 12,
        mode: 'automatic',
      }),
    ).resolves.toMatchObject({ handle: 4, state: 'succeeded' });
    expect(collector.collect).toHaveBeenCalledTimes(1);
    expect(checks.runAll).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(execute.mock.calls)).toContain(
      'test:12:telemetry.recover',
    );
  });
});
