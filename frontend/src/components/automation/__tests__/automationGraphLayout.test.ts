import { describe, expect, it } from 'vitest'
import {
  AUTOMATION_NODE_HEIGHT,
  AUTOMATION_NODE_WIDTH,
  layoutAutomationGraph,
  wrapAutomationLabel,
} from '../automationGraphLayout'
import type { AutomationGraph, AutomationRule } from '../automationInspection.types'

const rule = (id: string): AutomationRule => ({
  id,
  kind: 'field',
  handle: id,
  title: id,
  sourceEntity: 'document',
  targetEntity: 'ticket',
  operation: 'afterCreate',
  active: true,
  priority: 0,
  conditions: [],
  referencePath: [],
  assignments: [],
  recipientField: null,
  templateHandle: null,
  repeated: false,
  notifyActor: false,
  configurationEntity: 'fieldAutomation',
})
function fixture(): AutomationGraph {
  const first = rule('first'),
    second = rule('second')
  return {
    nodes: [
      { id: 'created', type: 'event', entity: 'document' },
      ...['rule', 'condition', 'reference', 'action'].map((type) => ({
        id: `${type}:first`,
        type,
        entity: 'document',
        rule: first,
      })),
      ...['rule', 'action'].map((type) => ({
        id: `${type}:second`,
        type,
        entity: 'document',
        rule: second,
      })),
      { id: 'updated', type: 'event', entity: 'ticket', cycle: true },
    ],
    edges: [
      { source: 'created', target: 'rule:first', kind: 'requires' },
      { source: 'created', target: 'rule:second', kind: 'requires' },
      { source: 'rule:first', target: 'condition:first', kind: 'requires' },
      { source: 'condition:first', target: 'reference:first', kind: 'requires' },
      { source: 'reference:first', target: 'action:first', kind: 'requires' },
      { source: 'rule:second', target: 'action:second', kind: 'requires' },
      { source: 'action:first', target: 'updated', kind: 'possible' },
      { source: 'action:second', target: 'created', kind: 'possible' },
    ],
    continuations: [],
    truncated: false,
  }
}

describe('Automation graph lanes and connectors', () => {
  it('aligns each complete rule and keeps rules without optional steps on their own lane', () => {
    const graph = fixture(),
      layout = layoutAutomationGraph(graph)
    expect(layout.nodes).toHaveLength(graph.nodes.length)
    expect(layout.edges).toHaveLength(graph.edges.length)
    const first = layout.nodes.filter((node) => node.rule?.id === 'first')
    const second = layout.nodes.filter((node) => node.rule?.id === 'second')
    expect(new Set(first.map((node) => node.y)).size).toBe(1)
    expect(new Set(second.map((node) => node.y)).size).toBe(1)
    expect(second[0]!.y - first[0]!.y).toBeGreaterThan(AUTOMATION_NODE_HEIGHT)
    for (const [index, node] of layout.nodes.entries()) {
      for (const other of layout.nodes.slice(index + 1)) {
        expect(
          Math.abs(node.x - other.x) >= AUTOMATION_NODE_WIDTH ||
            Math.abs(node.y - other.y) >= AUTOMATION_NODE_HEIGHT,
        ).toBe(true)
      }
    }
  })

  it('routes possible follow-ups below the nodes on separate tracks and retains cycles', () => {
    const layout = layoutAutomationGraph(fixture())
    const bottom = Math.max(...layout.nodes.map((node) => node.y + AUTOMATION_NODE_HEIGHT))
    const returns = layout.edges.filter((edge) => edge.kind === 'possible')
    expect(returns).toHaveLength(2)
    const tracks = returns.map((edge) => Number(edge.path.match(/V (\d+(?:\.\d+)?)/u)?.[1]))
    expect(tracks.every((y) => y > bottom && y < layout.height)).toBe(true)
    expect(new Set(tracks).size).toBe(2)
    expect(layout.nodes.find((node) => node.id === 'updated')?.cycle).toBe(true)
  })

  it('handles a standalone event and missing edge endpoints without invalid coordinates', () => {
    const layout = layoutAutomationGraph({
      nodes: [{ id: 'only', entity: 'ticket', type: 'event' }],
      edges: [{ source: 'only', target: 'missing', kind: 'requires' }],
      continuations: [],
      truncated: false,
    })
    expect(layout.edges).toEqual([])
    expect(layout.nodes[0]!.y).toBeGreaterThan(0)
    expect(Number.isFinite(layout.height)).toBe(true)
  })

  it('wraps long labels into three readable lines and marks truncation', () => {
    expect(wrapAutomationLabel('Status → Qualifizieren')).toEqual(['Status → Qualifizieren'])
    const lines = wrapAutomationLabel(
      'Ticketverantwortliche über eingehende Dokumente und neue E-Mails sowie Änderungen an Datensätzen ausführlich benachrichtigen',
    )
    expect(lines).toHaveLength(3)
    expect(lines.every((line) => line.length <= 32)).toBe(true)
    expect(lines[2]).toMatch(/…$/u)
  })
})
