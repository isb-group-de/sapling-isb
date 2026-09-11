import type { AutomationCondition } from '../../entity/FieldAutomationItem';

type ConditionalAutomationRule = {
  conditions?: AutomationCondition[] | null;
  sourceEntity?: unknown;
};

/** True when a subscription has at least one condition that must be evaluated. */
export function hasAutomationConditions(
  rule: ConditionalAutomationRule,
): boolean {
  return Array.isArray(rule.conditions) && rule.conditions.length > 0;
}

/**
 * Explicit-source subscriptions always use the durable automation processor.
 * A legacy subscription without a source also uses it when conditions need the
 * event's old/new snapshots. Unconditional legacy subscriptions stay on the
 * synchronous compatibility path.
 */
export function usesDurableAutomationProcessor(
  rule: ConditionalAutomationRule,
): boolean {
  return rule.sourceEntity != null || hasAutomationConditions(rule);
}
