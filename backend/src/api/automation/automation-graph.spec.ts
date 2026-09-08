import { automationRuleView, buildAutomationGraph } from './automation-graph';

const field = (handle: number, source = 'document', target = 'ticket') =>
  automationRuleView(
    {
      handle,
      description: 'Qualifizieren',
      sourceEntity: { handle: source },
      targetEntity: { handle: target },
      operation: {
        handle: source === 'document' ? 'afterInsert' : 'afterUpdate',
      },
      isActive: true,
      priority: 20,
      referencePath: [{ field: 'referenceHandle', entity: 'ticket' }],
      conditions: [
        {
          field: 'type',
          scope: 'source',
          operator: 'equals',
          newValue: 'email',
          groupOrder: 0,
        },
      ],
      assignments: [{ field: 'status', value: 'qualify' }],
    },
    'field',
  );

describe('Automation inspection graph', () => {
  it('includes incoming document rules from the target ticket and preserves conditions and assignments', () => {
    const rule = field(1);
    const graph = buildAutomationGraph([rule], 'ticket');
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'event:document:afterInsert' }),
        expect.objectContaining({ id: 'reference:field:1', rule }),
        expect.objectContaining({ id: 'event:ticket:afterUpdate' }),
      ]),
    );
    expect(graph.edges).toContainEqual({
      source: 'action:field:1',
      target: 'event:ticket:afterUpdate',
      kind: 'possible',
    });
  });
  it('preserves OR groups, priorities, notification suppression and inactive templates', () => {
    const rule = automationRuleView(
      {
        handle: 7,
        entity: 'ticket',
        type: 'afterUpdate',
        isActive: true,
        description: 'Mail',
        priority: 10,
        allowRepeatedSending: false,
        template: { handle: 2, isActive: false },
        conditions: {
          getItems: () => [
            {
              observedField: 'status',
              oldValue: 'new',
              newValue: 'qualify',
              groupOrder: 2,
            },
          ],
        },
      },
      'email',
    );
    expect(rule).toMatchObject({
      active: false,
      repeated: false,
      priority: 10,
      conditions: [{ field: 'status', groupOrder: 2 }],
    });
    expect(buildAutomationGraph([rule], 'ticket').nodes).toHaveLength(0);
    expect(
      buildAutomationGraph([rule], 'ticket', 1, true).nodes.length,
    ).toBeGreaterThan(0);
  });
  it('marks cycles without infinite recursion and limits graph responses', () => {
    const graph = buildAutomationGraph(
      [field(1, 'ticket', 'ticket')],
      'ticket',
      8,
    );
    expect(graph.nodes.some((node) => node.cycle)).toBe(true);
    const bounded = buildAutomationGraph(
      Array.from({ length: 100 }, (_, i) => field(i)),
      'ticket',
      8,
    );
    expect(bounded.nodes.length).toBeLessThanOrEqual(200);
    expect(bounded.truncated).toBe(true);
    expect(bounded.continuations.length).toBeGreaterThan(0);
  });
});
