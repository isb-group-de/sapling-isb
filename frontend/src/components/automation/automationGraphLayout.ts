import type { AutomationGraph, GraphNode } from './automationInspection.types'

export const AUTOMATION_NODE_WIDTH = 244
export const AUTOMATION_NODE_HEIGHT = 108
export const AUTOMATION_COLUMNS = ['event', 'rule', 'condition', 'reference', 'action'] as const
const COLUMN_GAP = 88
const ROW_GAP = 36
const TOP = 64
const LEFT = 48

export interface PositionedAutomationNode extends GraphNode {
  x: number
  y: number
}

/** Keep every rule on one lane, including rules without conditions or references. */
export function layoutAutomationGraph(graph: AutomationGraph) {
  const positioned = new Map<string, PositionedAutomationNode>()
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const rules = new Map<string, GraphNode[]>()
  for (const node of graph.nodes) {
    if (node.rule) rules.set(node.rule.id, [...(rules.get(node.rule.id) ?? []), node])
  }
  const placedRules = new Set<string>()
  const lanes: { id: string; y: number }[] = []
  let nextY = TOP
  const columnX = (type: string) =>
    LEFT +
    Math.max(0, AUTOMATION_COLUMNS.indexOf(type as (typeof AUTOMATION_COLUMNS)[number])) *
      (AUTOMATION_NODE_WIDTH + COLUMN_GAP)
  const place = (node: GraphNode, y: number) =>
    positioned.set(node.id, { ...node, x: columnX(node.type), y })
  const placeRule = (id: string) => {
    if (placedRules.has(id)) return
    placedRules.add(id)
    lanes.push({ id, y: nextY })
    for (const node of rules.get(id) ?? []) place(node, nextY)
    nextY += AUTOMATION_NODE_HEIGHT + ROW_GAP
  }
  for (const event of graph.nodes.filter((node) => node.type === 'event')) {
    const firstY = nextY
    for (const edge of graph.edges.filter(
      (edge) => edge.source === event.id && edge.kind !== 'possible',
    )) {
      const id = byId.get(edge.target)?.rule?.id
      if (id) placeRule(id)
    }
    if (nextY === firstY) nextY += AUTOMATION_NODE_HEIGHT + ROW_GAP
    place(event, (firstY + nextY - AUTOMATION_NODE_HEIGHT - ROW_GAP) / 2)
    nextY += ROW_GAP
  }
  for (const id of rules.keys()) placeRule(id)
  for (const node of graph.nodes) {
    if (!positioned.has(node.id)) {
      place(node, nextY)
      nextY += AUTOMATION_NODE_HEIGHT + ROW_GAP
    }
  }

  const nodes = [...positioned.values()]
  const right = columnX('action') + AUTOMATION_NODE_WIDTH
  const bottom = Math.max(TOP, ...nodes.map((node) => node.y + AUTOMATION_NODE_HEIGHT))
  let returnLane = 0
  const edges = graph.edges.flatMap((edge, index) => {
    const source = positioned.get(edge.source),
      target = positioned.get(edge.target)
    if (!source || !target) return []
    const sx = source.x + AUTOMATION_NODE_WIDTH,
      sy = source.y + AUTOMATION_NODE_HEIGHT / 2
    const tx = target.x,
      ty = target.y + AUTOMATION_NODE_HEIGHT / 2
    const returning = tx <= sx || edge.kind === 'possible'
    let path: string
    if (returning) {
      // Return channels stay outside every node, with separate bottom and side tracks.
      const track = returnLane++
      const rx = right + 24 + track * 14,
        lx = LEFT - 18 - track * 6
      const by = bottom + 36 + track * 18
      path = `M ${sx} ${sy} H ${rx} V ${by} H ${lx} V ${ty} H ${tx - 7}`
    } else {
      const siblings = graph.edges.filter(
        (candidate) => candidate.source === edge.source && candidate.kind !== 'possible',
      )
      const sibling = siblings.indexOf(edge)
      const channel = sx + 24 + ((sibling + 1) * (COLUMN_GAP - 48)) / (siblings.length + 1)
      path =
        sy === ty
          ? `M ${sx} ${sy} H ${tx - 7}`
          : `M ${sx} ${sy} H ${channel - 8} Q ${channel} ${sy} ${channel} ${sy + Math.sign(ty - sy) * 8} V ${ty - Math.sign(ty - sy) * 8} Q ${channel} ${ty} ${channel + 8} ${ty} H ${tx - 7}`
    }
    return [
      {
        ...edge,
        key: `${edge.source}:${edge.target}:${index}`,
        path,
        ruleId: source.rule?.id ?? target.rule?.id,
      },
    ]
  })
  // Shift return channels into positive SVG coordinates even for large graphs.
  const offset = Math.max(0, returnLane * 6 - 24)
  return {
    nodes,
    edges,
    lanes,
    offset,
    columns: AUTOMATION_COLUMNS.map((type) => ({ type, x: columnX(type) })),
    width: right + 48 + returnLane * 14 + offset,
    height: Math.max(280, bottom + 64 + returnLane * 18),
  }
}

export function wrapAutomationLabel(text: string): string[] {
  const chunks = text.trim().match(/.{1,32}(?:\s|$)|.{1,32}/gu) ?? []
  const lines = chunks.slice(0, 3).map((line) => line.trim())
  if (chunks.length > 3) lines[2] = `${lines[2]!.slice(0, 30)}…`
  return lines
}
