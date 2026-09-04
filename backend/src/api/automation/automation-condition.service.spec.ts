import { AutomationConditionService } from './automation-condition.service';

describe('AutomationConditionService', () => {
  const service = new AutomationConditionService();

  it('requires every condition in an AND group and accepts alternative OR groups', () => {
    expect(
      service.matches(
        [
          {
            scope: 'source',
            field: 'status',
            operator: 'transition',
            oldValue: 'waiting',
            newValue: 'open',
            groupOrder: 0,
          },
          {
            scope: 'source',
            field: 'type',
            operator: 'equals',
            newValue: 'email',
            groupOrder: 0,
          },
          {
            scope: 'target',
            field: 'priority',
            operator: 'equals',
            newValue: 'urgent',
            groupOrder: 1,
          },
        ],
        { status: 'waiting', type: 'email' },
        { status: 'open', type: 'email' },
        { priority: 'normal' },
      ),
    ).toBe(true);
  });

  it('distinguishes a value check from a changes-to condition', () => {
    const oldValue = { status: { handle: 'open' } };
    const newValue = { status: { handle: 'open' } };
    expect(
      service.matches(
        [
          {
            scope: 'source',
            field: 'status',
            operator: 'equals',
            newValue: 'open',
          },
        ],
        oldValue,
        newValue,
        {},
      ),
    ).toBe(true);
    expect(
      service.matches(
        [
          {
            scope: 'source',
            field: 'status',
            operator: 'changesTo',
            newValue: 'open',
          },
        ],
        oldValue,
        newValue,
        {},
      ),
    ).toBe(false);
  });

  it('supports custom-field paths and pure change checks', () => {
    expect(
      service.matches(
        [
          {
            scope: 'source',
            field: 'customFields.customerState',
            operator: 'changed',
          },
        ],
        { customFields: { customerState: null } },
        { customFields: { customerState: 'active' } },
        {},
      ),
    ).toBe(true);
  });
});
