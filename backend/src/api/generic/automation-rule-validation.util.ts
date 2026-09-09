import type {
  AutomationAssignment,
  AutomationCondition,
  AutomationPathStep,
} from '../../entity/FieldAutomationItem';
import type { AutomationReferenceResolverService } from '../automation/automation-reference-resolver.service';

const AUTOMATION_RULE_ENTITIES = new Set([
  'fieldAutomation',
  'inboxSubscription',
  'teamsSubscription',
  'webhookSubscription',
]);

export function isAutomationRuleEntity(entityHandle: string): boolean {
  return AUTOMATION_RULE_ENTITIES.has(entityHandle);
}

export function validateAutomationRuleConfiguration(
  automationPaths: AutomationReferenceResolverService | undefined,
  entityHandle: string,
  data: Record<string, unknown>,
): void {
  if (!automationPaths || !isAutomationRuleEntity(entityHandle)) return;
  const source = referenceHandle(data.sourceEntity);
  const target = referenceHandle(
    entityHandle === 'fieldAutomation' ? data.targetEntity : data.entity,
  );
  if (!source || !target) return;
  const path = Array.isArray(data.referencePath)
    ? (data.referencePath as AutomationPathStep[])
    : [];
  const conditions = Array.isArray(data.conditions)
    ? (data.conditions as AutomationCondition[])
    : [];
  const assignments = Array.isArray(data.assignments)
    ? (data.assignments as AutomationAssignment[])
    : [];
  automationPaths.validate(source, target, path);
  automationPaths.validateConfiguration(
    source,
    target,
    path,
    conditions,
    entityHandle === 'fieldAutomation' ? assignments : [],
  );
}

function referenceHandle(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const handle = (value as { handle?: unknown }).handle;
  return typeof handle === 'string' || typeof handle === 'number'
    ? String(handle)
    : '';
}
