export type AutomationRuleKind =
  'field' | 'inbox' | 'email' | 'teams' | 'webhook';
export interface AutomationRuleView {
  id: string;
  kind: AutomationRuleKind;
  handle: string;
  title: string;
  sourceEntity: string;
  targetEntity: string;
  operation: string;
  active: boolean;
  priority: number;
  conditions: unknown[];
  referencePath: unknown[];
  assignments: unknown[];
  recipientField: string | null;
  templateHandle: string | null;
  repeated: boolean;
  notifyActor: boolean;
  configurationEntity: string;
}
export interface AutomationGraphNode {
  id: string;
  type: 'event' | 'rule' | 'condition' | 'reference' | 'action';
  entity: string;
  operation?: string;
  rule?: AutomationRuleView;
  cycle?: boolean;
}
export interface AutomationGraph {
  nodes: AutomationGraphNode[];
  edges: { source: string; target: string; kind: 'requires' | 'possible' }[];
  continuations: string[];
  truncated: boolean;
}

function handle(value: unknown): string {
  if (value && typeof value === 'object' && 'handle' in value)
    value = value.handle;
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}
function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (
    value &&
    typeof value === 'object' &&
    'getItems' in value &&
    typeof value.getItems === 'function'
  ) {
    const items = (value as { getItems: () => unknown }).getItems();
    return Array.isArray(items) ? items : [];
  }
  return [];
}
export function automationRuleView(
  input: object,
  kind: AutomationRuleKind,
): AutomationRuleView {
  const rule = input as Record<string, unknown>;
  const targetEntity = handle(rule.targetEntity ?? rule.entity);
  const template = rule.template as
    { handle?: unknown; isActive?: boolean } | undefined;
  const conditions =
    kind === 'email'
      ? array(rule.conditions).map((value) => {
          const c = value as Record<string, unknown>;
          return {
            field: c.observedField,
            scope: 'source',
            oldValue: c.oldValue,
            newValue: c.newValue,
            groupOrder: c.groupOrder ?? 0,
          };
        })
      : array(rule.conditions);
  return {
    id: `${kind}:${handle(rule.handle)}`,
    kind,
    handle: handle(rule.handle),
    title: typeof rule.description === 'string' ? rule.description : '',
    sourceEntity: handle(rule.sourceEntity) || targetEntity,
    targetEntity,
    operation: handle(rule.operation ?? rule.type),
    active: rule.isActive === true && template?.isActive !== false,
    priority: Number(rule.priority ?? 0),
    conditions,
    referencePath: array(rule.referencePath),
    assignments: array(rule.assignments),
    recipientField:
      typeof rule.recipientField === 'string' ? rule.recipientField : null,
    templateHandle: template ? handle(template) : null,
    repeated: rule.allowRepeatedSending !== false,
    notifyActor: rule.notifyActor === true,
    configurationEntity:
      kind === 'field' ? 'fieldAutomation' : `${kind}Subscription`,
  };
}

/** A dependency graph, deliberately not an execution schedule or simulator. */
export function buildAutomationGraph(
  allRules: AutomationRuleView[],
  entity: string,
  depth = 1,
  includeInactive = false,
): AutomationGraph {
  const rules = allRules
    .filter((rule) => includeInactive || rule.active)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const nodes = new Map<string, AutomationGraphNode>();
  const edges: AutomationGraph['edges'] = [];
  const edgeKeys = new Set<string>();
  const included = new Set<string>();
  const continuations = new Set<string>();
  let frontier = new Set([entity]);
  const visited = new Set<string>();
  const link = (
    source: string,
    target: string,
    kind: 'requires' | 'possible' = 'requires',
  ) => {
    const key = `${source}|${target}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({ source, target, kind });
    }
  };
  let truncated = false;
  for (let level = 0; level <= depth; level++) {
    const next = new Set<string>();
    for (const current of frontier) {
      visited.add(current);
      for (const rule of rules.filter(
        (candidate) =>
          candidate.sourceEntity === current ||
          candidate.targetEntity === current,
      )) {
        if (included.has(rule.id)) continue;
        if (nodes.size + 6 > 200) {
          truncated = true;
          continuations.add(current);
          continue;
        }
        included.add(rule.id);
        const event = `event:${rule.sourceEntity}:${rule.operation}`;
        nodes.set(event, {
          id: event,
          type: 'event',
          entity: rule.sourceEntity,
          operation: rule.operation,
        });
        let previous = event;
        for (const type of [
          'rule',
          ...(rule.conditions.length ? ['condition'] : []),
          ...(rule.referencePath.length ? ['reference'] : []),
          'action',
        ] as AutomationGraphNode['type'][]) {
          const id = `${type}:${rule.id}`;
          nodes.set(id, {
            id,
            type,
            entity: type === 'action' ? rule.targetEntity : rule.sourceEntity,
            rule,
          });
          link(previous, id);
          previous = id;
        }
        if (rule.kind === 'field') {
          const changed = `event:${rule.targetEntity}:afterUpdate`;
          nodes.set(changed, {
            id: changed,
            type: 'event',
            entity: rule.targetEntity,
            operation: 'afterUpdate',
          });
          link(previous, changed, 'possible');
        }
        for (const adjacent of [rule.sourceEntity, rule.targetEntity])
          if (!visited.has(adjacent)) next.add(adjacent);
      }
    }
    frontier = next;
  }
  for (const next of frontier)
    if (
      rules.some(
        (r) =>
          !included.has(r.id) &&
          (r.sourceEntity === next || r.targetEntity === next),
      )
    )
      continuations.add(next);
  // Mark actual back edges, not merely repeated entities.
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      const node = nodes.get(id);
      if (node) node.cycle = true;
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    for (const edge of edges.filter((e) => e.source === id)) visit(edge.target);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of nodes.keys()) visit(id);
  return {
    nodes: [...nodes.values()],
    edges,
    continuations: [...continuations],
    truncated,
  };
}
