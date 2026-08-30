/**
 * Represents CPU information.
 */
export interface Cpu {
  manufacturer: string
  brand: string
  vendor: string
  family: string
  model: string
  stepping: string
  revision: string
  voltage: string
  speed: number
  speedMin: number
  speedMax: number
  governor: string
  cores: number
  physicalCores: number
  performanceCores?: number
  efficiencyCores?: number
  processors: number
  socket: string
  flags: string
  virtualization: boolean
}

/**
 * Represents CPU speed/load information.
 */
export interface CpuSpeed {
  currentLoad: number
  currentLoadUser: number
  currentLoadSystem: number
}

/**
 * Represents filesystem information.
 */
export interface Filesystem {
  fs: string
  type: string
  size: number
  used: number
  available: number
  use: number
}

/**
 * Represents memory information.
 */
export interface Memory {
  total: number
  free: number
  used: number
  active: number
  available: number
}

/**
 * Represents a network interface.
 */
export interface NetworkInterface {
  iface: string
  operstate: string
  rx_bytes: number
  rx_dropped: number
  rx_errors: number
  tx_bytes: number
  tx_dropped: number
  tx_errors: number
  rx_sec: number
  tx_sec: number
  ms: number
}

/**
 * Represents operating system information.
 */
export interface OperatingSystem {
  platform: string
  distro: string
  release: string
  kernel: string
  codename: string
  arch: string
  hostname: string
  fqdn: string
  codepage: string
  logofile: string
}

/**
 * Represents application state.
 */
export interface ApplicationState {
  isReady: boolean
}

/**
 * Represents time information.
 */
export interface Time {
  current: string | number
  uptime: string | number
  timezone: string
  timezoneName: string
}

/**
 * Represents application version.
 */
export interface ApplicationVersion {
  version: string
}

/**
 * Represents PostgreSQL diagnostics for the active Sapling database.
 */
export interface Database {
  engine: string
  name: string
  version: string
  schema: string
  size: number
  activeConnections: number
  maxConnections: number
  startedAt: string
  tableCount: number
  largestTables: Array<{
    schema: string
    name: string
    size: number
  }>
}

/**
 * Represents the local document-storage footprint grouped by entity folder.
 */
export interface DocumentStorage {
  totalSize: number
  totalFileCount: number
  entityCount: number
  entities: Array<{
    entityHandle: string
    size: number
    fileCount: number
  }>
}

export type MonitoringRange = { from: string; to: string }

export interface MonitoringSummary {
  range: MonitoringRange
  lastSampleAt: string | null
  health: 'healthy' | 'warning' | 'critical' | 'unknown'
  metrics: Record<string, number>
  requests: {
    requestCount: number
    clientErrorCount: number
    serverErrorCount: number
    requestBytes: number
    responseBytes: number
    averageDurationMs: number
    durationP95Ms: number
    durationMaxMs: number
    serverErrorRate: number
  }
  users: { onlineUsers: number; usersWithSessions: number }
  ai: { totalTokens: number; callCount: number; errorCount: number; reportedCount: number }
  incidents: { openCount: number; criticalCount: number }
}

export interface MonitoringSeriesPoint {
  metricKey: string
  dimensionKey: string
  capturedAt: string
  sampleCount: number
  minimum: number
  maximum: number
  sum: number
  last: number
  average: number
}

export interface MonitoringUser {
  handle: number
  firstName?: string | null
  lastName: string
  isActive: boolean
  requests: number
  errors: number
  traffic: number
  lastActivityAt?: string | null
  tokens: number
  lastLoginAt?: string | null
  sessionCount: number
  online: boolean
}

export interface MonitoringIncident {
  handle: number
  fingerprint: string
  dimensionKey: string
  state: 'open' | 'resolved'
  severity: 'warning' | 'critical'
  observedValue: number
  threshold: number
  healthyEvaluations: number
  firstSeenAt: string
  lastSeenAt: string
  resolvedAt?: string | null
  rule: MonitoringAlertRule
}

export interface MonitoringAlertRule {
  handle: string
  title: string
  metricKey: string
  severity: 'warning' | 'critical'
  comparator: 'gt' | 'gte' | 'lt' | 'lte'
  threshold: number
  windowSeconds: number
  minimumCount: number
  scope: string
  isActive: boolean
}
