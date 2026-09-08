import { AutomationInspectionService } from './automation-inspection.service';
import { AutomationExecutionItem } from '../../entity/AutomationExecutionItem';
import { TeamsDeliveryItem } from '../../entity/TeamsDeliveryItem';

describe('Automation history evidence', () => {
  it('joins deliveries only by the execution key and leaves old email deliveries independent', async () => {
    const createdAt = new Date('2026-09-07T10:00:00Z');
    const execution = {
      handle: 5,
      actionType: 'teams',
      ruleHandle: 7,
      status: 'completed',
      createdAt,
      deduplicationKey: 'event-1:teams:7:ticket:42',
      ruleSnapshot: null,
      targetEntity: { handle: 'ticket' },
      targetHandle: '42',
      event: {
        eventId: 'event-1',
        chainId: 'chain-1',
        status: 'completed',
        sourceEntity: { handle: 'document' },
        sourceHandle: '99',
      },
    };
    const em = {
      findAndCount: jest.fn((model: unknown) =>
        Promise.resolve(
          model === AutomationExecutionItem
            ? [[execution], 1]
            : [
                [
                  {
                    handle: 9,
                    subject: 'Ticket updated',
                    toRecipients: ['customer@example.test'],
                    subscription: { handle: 3 },
                    status: { handle: 'success' },
                    attemptCount: 1,
                    createdAt,
                  },
                ],
                1,
              ],
        ),
      ),
      find: jest.fn((model: unknown) =>
        Promise.resolve(
          model === TeamsDeliveryItem
            ? [
                {
                  handle: 10,
                  automationDeduplicationKey: execution.deduplicationKey,
                  status: { handle: 'failed' },
                  attemptCount: 2,
                  createdAt,
                },
              ]
            : [],
        ),
      ),
    };
    const history = await new AutomationInspectionService(em as never).history(
      'ticket',
      '42',
      1,
    );
    expect(history.executions[0]).toMatchObject({
      status: 'completed',
      ruleSnapshot: null,
      chainId: 'chain-1',
      deliveries: [{ status: 'failed', attemptCount: 2 }],
    });
    expect(history.independentEmails[0]).toMatchObject({
      chainId: null,
      ruleSnapshot: null,
      status: 'success',
      subject: 'Ticket updated',
      toRecipients: ['customer@example.test'],
    });
    expect(em.find).toHaveBeenCalledWith(
      TeamsDeliveryItem,
      { automationDeduplicationKey: { $in: [execution.deduplicationKey] } },
      expect.anything(),
    );
    expect(history.hasMore).toBe(false);
  });

  it('does not fabricate skipped executions when no history was recorded', async () => {
    const em = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      find: jest.fn(),
    };
    const history = await new AutomationInspectionService(em as never).history(
      'ticket',
      '42',
      2,
    );
    expect(history).toMatchObject({
      page: 2,
      executions: [],
      independentEmails: [],
      hasMore: false,
    });
    expect(em.find).not.toHaveBeenCalled();
  });
});
