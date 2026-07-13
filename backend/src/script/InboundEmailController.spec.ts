import { InboundEmailController } from './InboundEmailController';

describe('InboundEmailController', () => {
  it('queues configured inbound emails for manual reprocessing', async () => {
    const emailInboxSyncService = {
      reprocessInboundEmail: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new InboundEmailController(
      { handle: 'inboundEmail' } as never,
      { handle: 7 } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      emailInboxSyncService as never,
    );

    await controller.execute([{ handle: 12 }, { handle: '13' }], 'reprocessInboundEmail');

    expect(emailInboxSyncService.reprocessInboundEmail).toHaveBeenNthCalledWith(1, 12);
    expect(emailInboxSyncService.reprocessInboundEmail).toHaveBeenNthCalledWith(2, 13);
  });

  it('delegates unrelated actions without starting a retry', async () => {
    const emailInboxSyncService = {
      reprocessInboundEmail: jest.fn(),
    };
    const controller = new InboundEmailController(
      { handle: 'inboundEmail' } as never,
      { handle: 7 } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      emailInboxSyncService as never,
    );

    await controller.execute([{ handle: 12 }], 'unknown');

    expect(emailInboxSyncService.reprocessInboundEmail).not.toHaveBeenCalled();
  });
});
