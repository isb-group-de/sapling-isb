import { AiUsageEventItem } from './AiUsageEventItem';
import { AuthenticationEventItem } from './AuthenticationEventItem';
import { HttpMetricBucketItem } from './HttpMetricBucketItem';
import { SystemAlertIncidentItem } from './SystemAlertIncidentItem';
import { SystemAlertRuleItem } from './SystemAlertRuleItem';
import { SystemMetricBucketItem } from './SystemMetricBucketItem';
import { SystemTelemetryInstanceItem } from './SystemTelemetryInstanceItem';
import {
  getSaplingFormLayout,
  getSaplingOptions,
} from './global/entity.decorator';

describe('system telemetry entity metadata', () => {
  const entities = [
    {
      entity: SystemTelemetryInstanceItem,
      valueField: 'hostname',
      visibleFields: ['hostname', 'appVersion', 'lastSampleAt'],
    },
    {
      entity: SystemMetricBucketItem,
      valueField: 'metricKey',
      visibleFields: ['instance', 'bucketStart', 'metricKey', 'last'],
    },
    {
      entity: HttpMetricBucketItem,
      valueField: 'attributionKey',
      visibleFields: ['bucketStart', 'attributionKey', 'requestCount'],
    },
    {
      entity: AiUsageEventItem,
      valueField: 'operation',
      visibleFields: ['person', 'operation', 'status', 'occurredAt'],
    },
    {
      entity: AuthenticationEventItem,
      valueField: 'eventType',
      visibleFields: ['person', 'eventType', 'provider', 'occurredAt'],
    },
    {
      entity: SystemAlertRuleItem,
      valueField: 'title',
      visibleFields: ['title', 'metricKey', 'severity', 'threshold'],
    },
    {
      entity: SystemAlertIncidentItem,
      valueField: 'fingerprint',
      visibleFields: ['rule', 'state', 'severity', 'lastSeenAt'],
    },
  ] as const;

  it.each(entities)(
    'defines a value field and visible read-only columns for $entity.name',
    ({ entity, valueField, visibleFields }) => {
      const prototype = entity.prototype;

      expect(getSaplingOptions(prototype, valueField)).toContain('isValue');

      for (const field of visibleFields) {
        expect(getSaplingFormLayout(prototype, field).tableVisible).toBe(true);
        expect(getSaplingOptions(prototype, field)).toContain('isReadOnly');
      }
    },
  );
});
