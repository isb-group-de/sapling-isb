import {
  evaluateAgentResult,
  validateExpectations,
} from './ai-evaluation.utils';

describe('Structured agent evaluation', () => {
  it('evaluates tools, target entities, response criteria and prohibited actions independently', () => {
    const result = evaluateAgentResult(
      {
        requiredTools: ['generic_get'],
        forbiddenTools: ['generic_delete'],
        targetEntities: ['ticket'],
        contains: ['Ergebnis'],
        forbiddenText: ['secret'],
        maxToolCalls: 1,
      },
      'secret',
      [
        { toolName: 'generic_delete', arguments: { entityHandle: 'person' } },
        { toolName: 'mail', arguments: {} },
      ],
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'missingTool:generic_get',
        'forbiddenTool:generic_delete',
        'unexpectedEntity:person',
        'missingText:Ergebnis',
        'forbiddenText:secret',
        'toolCallLimit',
      ]),
    );
  });
  it('rejects unbounded or unknown expectation contracts', () => {
    expect(() => validateExpectations({ maxToolCalls: -1 })).toThrow();
    expect(() => validateExpectations({ executable: 'do anything' })).toThrow();
    expect(
      validateExpectations({ contains: ['done'], maxToolCalls: 0 }),
    ).toEqual({ contains: ['done'], maxToolCalls: 0 });
  });
});
