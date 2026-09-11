import { validateAutomationRuleConfiguration } from './automation-rule-validation.util';

describe('validateAutomationRuleConfiguration', () => {
  it('validates conditions against the target entity when the source is implicit', () => {
    const automationPaths = {
      validate: jest.fn(),
      validateConfiguration: jest.fn(),
    };
    const conditions = [
      {
        scope: 'target' as const,
        field: 'assigneePerson',
        operator: 'equals' as const,
        newValue: 2,
      },
    ];

    validateAutomationRuleConfiguration(
      automationPaths as never,
      'teamsSubscription',
      {
        sourceEntity: null,
        entity: 'ticket',
        referencePath: [],
        conditions,
      },
    );

    expect(automationPaths.validate).toHaveBeenCalledWith(
      'ticket',
      'ticket',
      [],
    );
    expect(automationPaths.validateConfiguration).toHaveBeenCalledWith(
      'ticket',
      'ticket',
      [],
      conditions,
      [],
    );
  });
});
