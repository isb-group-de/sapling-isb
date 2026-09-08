export interface AutomationRule {
  id: string
  kind: string
  handle: string
  title: string
  sourceEntity: string
  targetEntity: string
  operation: string
  active: boolean
  priority: number
  conditions: Record<string, unknown>[]
  referencePath: Record<string, unknown>[]
  assignments: Record<string, unknown>[]
  recipientField: string | null
  templateHandle: string | null
  repeated: boolean
  notifyActor: boolean
  configurationEntity: string
}
export interface GraphNode {
  id: string
  type: string
  entity: string
  operation?: string
  rule?: AutomationRule
  cycle?: boolean
}
export interface AutomationGraph {
  nodes: GraphNode[]
  edges: { source: string; target: string; kind: string }[]
  continuations: string[]
  truncated: boolean
}
export interface DeliveryEvidence {
  subject?: string
  toRecipients?: string[]
  handle: number
  kind: string
  status: string
  attemptCount: number
  responseStatusCode?: number
  createdAt: string
  completedAt?: string
  nextRetryAt?: string
}
export interface ExecutionEvidence {
  handle: number
  kind: string
  status: string
  message?: string
  createdAt: string
  ruleSnapshot?: AutomationRule
  eventId: string
  chainId: string
  sourceEntity: string
  sourceHandle: string
  targetEntity: string
  targetHandle: string
  deliveries: DeliveryEvidence[]
}
export interface AutomationHistory {
  executions: ExecutionEvidence[]
  independentEmails: DeliveryEvidence[]
  hasMore: boolean
  page: number
}
