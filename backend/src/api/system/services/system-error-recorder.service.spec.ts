import { SystemErrorRecorderService } from './system-error-recorder.service';

describe('SystemErrorRecorderService', () => {
  it('groups errors with a stable fingerprint and redacts sensitive values', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce([{ handle: 7 }])
      .mockResolvedValueOnce([]);
    const em = { getConnection: () => ({ execute }) };
    const service = new SystemErrorRecorderService(
      { fork: () => em } as never,
      {
        currentId: 'test',
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
      { getVersion: () => ({ version: '1.2.3' }) },
      { instanceId: 'backend:0:boot' } as never,
    );
    const error = new Error(
      'Failed for user@example.org with token abcdefghijklmnopqrstuvwxyz123456',
    );
    error.stack = `Error: ${error.message}\n    at C:\\secret\\customer\\handler.ts:42:3`;

    await service.record({
      source: 'backend',
      operation: 'GET /api/person/12345',
      error,
      requestId: 'request-12345678',
    });

    expect(execute).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(execute.mock.calls);
    expect(serialized).not.toContain('user@example.org');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(serialized).not.toContain('C:\\\\secret');
    expect(serialized).toContain('[email]');
    expect(serialized).toContain('[redacted]');
    expect(serialized).toContain('GET /api/person/:id');
  });
});
