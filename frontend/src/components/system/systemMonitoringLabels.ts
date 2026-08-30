type MonitoringMetricDefinition = {
  translationKey: string
  de: string
  en: string
}

export const MONITORING_METRIC_DEFINITIONS: Record<string, MonitoringMetricDefinition> = {
  'host.cpu.percent': metric('HostCpuPercent', 'CPU-Auslastung', 'CPU utilization'),
  'host.cpu.userPercent': metric('HostCpuUserPercent', 'CPU-Benutzeranteil', 'CPU user time'),
  'host.cpu.systemPercent': metric('HostCpuSystemPercent', 'CPU-Systemanteil', 'CPU system time'),
  'host.load.1m': metric('HostLoad1m', 'Systemlast (1 Minute)', 'System load (1 minute)'),
  'host.load.5m': metric('HostLoad5m', 'Systemlast (5 Minuten)', 'System load (5 minutes)'),
  'host.load.15m': metric('HostLoad15m', 'Systemlast (15 Minuten)', 'System load (15 minutes)'),
  'host.memory.totalBytes': metric(
    'HostMemoryTotalBytes',
    'Arbeitsspeicher gesamt',
    'Total memory',
  ),
  'host.memory.usedBytes': metric('HostMemoryUsedBytes', 'Arbeitsspeicher belegt', 'Used memory'),
  'host.memory.usedPercent': metric(
    'HostMemoryUsedPercent',
    'Arbeitsspeicherauslastung',
    'Memory utilization',
  ),
  'host.memory.availableBytes': metric(
    'HostMemoryAvailableBytes',
    'Arbeitsspeicher verfügbar',
    'Available memory',
  ),
  'host.swap.usedBytes': metric('HostSwapUsedBytes', 'Auslagerungsspeicher belegt', 'Used swap'),
  'host.swap.usedPercent': metric(
    'HostSwapUsedPercent',
    'Auslagerungsspeicherauslastung',
    'Swap utilization',
  ),
  'process.cpu.percent': metric('ProcessCpuPercent', 'Backend-Prozess-CPU', 'Backend process CPU'),
  'process.memory.rssBytes': metric(
    'ProcessMemoryRssBytes',
    'Prozessspeicher (RSS)',
    'Process memory (RSS)',
  ),
  'process.memory.heapUsedBytes': metric('ProcessMemoryHeapUsedBytes', 'Heap belegt', 'Used heap'),
  'process.memory.heapTotalBytes': metric(
    'ProcessMemoryHeapTotalBytes',
    'Heap gesamt',
    'Total heap',
  ),
  'process.memory.externalBytes': metric(
    'ProcessMemoryExternalBytes',
    'Externer Prozessspeicher',
    'External process memory',
  ),
  'process.eventLoop.p95Ms': metric(
    'ProcessEventLoopP95Ms',
    'Event-Loop-Verzögerung (p95)',
    'Event loop delay (p95)',
  ),
  'process.uptimeSeconds': metric('ProcessUptimeSeconds', 'Backend-Laufzeit', 'Backend uptime'),
  'process.startedAtEpochMs': metric(
    'ProcessStartedAtEpochMs',
    'Backend-Startzeit',
    'Backend start time',
  ),
  'network.rxBytesPerSecond': metric(
    'NetworkRxBytesPerSecond',
    'Netzwerkempfang',
    'Network receive',
  ),
  'network.txBytesPerSecond': metric(
    'NetworkTxBytesPerSecond',
    'Netzwerkversand',
    'Network transmit',
  ),
  'network.rxErrors': metric(
    'NetworkRxErrors',
    'Netzwerk-Empfangsfehler',
    'Network receive errors',
  ),
  'network.txErrors': metric('NetworkTxErrors', 'Netzwerk-Sendefehler', 'Network transmit errors'),
  'network.rxDropped': metric(
    'NetworkRxDropped',
    'Verworfene Empfangspakete',
    'Dropped receive packets',
  ),
  'network.txDropped': metric(
    'NetworkTxDropped',
    'Verworfene Sendepakete',
    'Dropped transmit packets',
  ),
  'filesystem.usedPercent': metric(
    'FilesystemUsedPercent',
    'Dateisystemauslastung',
    'Filesystem utilization',
  ),
  'filesystem.usedBytes': metric(
    'FilesystemUsedBytes',
    'Dateisystem belegt',
    'Used filesystem space',
  ),
  'filesystem.sizeBytes': metric('FilesystemSizeBytes', 'Dateisystemgröße', 'Filesystem size'),
  'database.activeConnections': metric(
    'DatabaseActiveConnections',
    'Aktive Datenbankverbindungen',
    'Active database connections',
  ),
  'database.maxConnections': metric(
    'DatabaseMaxConnections',
    'Maximale Datenbankverbindungen',
    'Maximum database connections',
  ),
  'database.connectionUsedPercent': metric(
    'DatabaseConnectionUsedPercent',
    'Datenbankverbindungsauslastung',
    'Database connection utilization',
  ),
  'database.sizeBytes': metric('DatabaseSizeBytes', 'Datenbankgröße', 'Database size'),
  'documentStorage.sizeBytes': metric(
    'DocumentStorageSizeBytes',
    'Dokumentenspeichergröße',
    'Document storage size',
  ),
  'documentStorage.fileCount': metric(
    'DocumentStorageFileCount',
    'Dokumentenanzahl',
    'Document count',
  ),
  'queue.waiting': metric('QueueWaiting', 'Wartende Queue-Aufträge', 'Waiting queue jobs'),
  'queue.active': metric('QueueActive', 'Aktive Queue-Aufträge', 'Active queue jobs'),
  'queue.failed': metric('QueueFailed', 'Fehlgeschlagene Queue-Aufträge', 'Failed queue jobs'),
  'queue.delayed': metric('QueueDelayed', 'Verzögerte Queue-Aufträge', 'Delayed queue jobs'),
  'queue.paused': metric('QueuePaused', 'Pausierte Queue', 'Paused queue'),
  'http.5xxRate': metric('Http5xxRate', 'HTTP-5xx-Fehlerrate', 'HTTP 5xx error rate'),
  'http.p95Ms': metric('HttpP95Ms', 'HTTP-Latenz (p95)', 'HTTP latency (p95)'),
  'ai.errorRate': metric('AiErrorRate', 'KI-Fehlerrate', 'AI error rate'),
  'collector.gapSeconds': metric('CollectorGapSeconds', 'Collector-Messlücke', 'Collector gap'),
  'telemetry.spool.overflow': metric(
    'TelemetrySpoolOverflow',
    'Telemetrie-Spool-Überlauf',
    'Telemetry spool overflow',
  ),
  'user.ai.totalTokens': metric('UserAiTotalTokens', 'KI-Tokens je Benutzer', 'AI tokens per user'),
  'user.http.trafficBytes': metric(
    'UserHttpTrafficBytes',
    'HTTP-Traffic je Benutzer',
    'HTTP traffic per user',
  ),
}

export function monitoringMetricLabel(
  translate: (key: string) => string,
  locale: string,
  metricKey: string,
) {
  const definition = MONITORING_METRIC_DEFINITIONS[metricKey]
  if (!definition) return humanizeMetricKey(metricKey)
  const translated = translate(definition.translationKey)
  if (translated.trim() && translated !== definition.translationKey) return translated
  return locale.toLowerCase().startsWith('de') ? definition.de : definition.en
}

function metric(suffix: string, de: string, en: string): MonitoringMetricDefinition {
  return { translationKey: `system.monitoringMetric${suffix}`, de, en }
}

function humanizeMetricKey(metricKey: string) {
  return metricKey
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
}
