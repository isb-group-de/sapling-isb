import { ScriptResultClientMethods } from './core/script.result.client';
import { EmailInboxSubscriptionController } from './EmailInboxSubscriptionController';

function createController(options?: {
  isAdministrator?: boolean;
  enqueueSubscriptionNow?: jest.Mock;
}) {
  const enqueueSubscriptionNow =
    options?.enqueueSubscriptionNow ?? jest.fn().mockResolvedValue(undefined);
  const controller = new EmailInboxSubscriptionController(
    { handle: 'emailInboxSubscription' } as never,
    {
      handle: 7,
      roles: [{ isAdministrator: options?.isAdministrator ?? true }],
    } as never,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { enqueueSubscriptionNow } as never,
  );

  return { controller, enqueueSubscriptionNow };
}

describe('EmailInboxSubscriptionController', () => {
  it('requests one immediate synchronization for the selected subscription', async () => {
    const { controller, enqueueSubscriptionNow } = createController();

    const result = await controller.execute(
      [{ handle: 12, description: 'Support' }],
      'synchronizeEmailInbox',
    );

    expect(enqueueSubscriptionNow).toHaveBeenCalledWith(12);
    expect(result.method).toBe(ScriptResultClientMethods.showMessage);
    expect(JSON.parse(result.parameter)).toEqual(
      expect.objectContaining({
        message: 'emailInboxSubscription.manualSynchronizationRequested',
        technical: { subscriptionHandle: 12 },
      }),
    );
  });

  it('does not allow a non-administrator to start the administrative action', async () => {
    const { controller, enqueueSubscriptionNow } = createController({
      isAdministrator: false,
    });

    await expect(
      controller.execute([{ handle: 12 }], 'synchronizeEmailInbox'),
    ).rejects.toThrow('global.permissionDenied');
    expect(enqueueSubscriptionNow).not.toHaveBeenCalled();
  });

  it('delegates unrelated actions without starting synchronization', async () => {
    const { controller, enqueueSubscriptionNow } = createController();

    await controller.execute([{ handle: 12 }], 'unknown');

    expect(enqueueSubscriptionNow).not.toHaveBeenCalled();
  });
});
