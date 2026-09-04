import { Injectable } from '@nestjs/common';
import type { AutomationCondition } from '../../entity/FieldAutomationItem';
import { areChangeLogValuesEqual } from '../generic/generic-change-log.util';

@Injectable()
export class AutomationConditionService {
  matches(
    conditions: AutomationCondition[],
    sourceOld: unknown,
    sourceNew: unknown,
    target: unknown,
  ): boolean {
    if (!Array.isArray(conditions) || conditions.length === 0) return true;
    const groups = new Map<number, AutomationCondition[]>();
    for (const condition of conditions) {
      const key = Number(condition.groupOrder ?? 0);
      groups.set(key, [...(groups.get(key) ?? []), condition]);
    }
    return [...groups.values()].some((group) =>
      group.every((condition) => {
        const oldSnapshot = condition.scope === 'source' ? sourceOld : target;
        const newSnapshot = condition.scope === 'source' ? sourceNew : target;
        const oldValue = this.value(oldSnapshot, condition.field);
        const newValue = this.value(newSnapshot, condition.field);
        const hasOld = 'oldValue' in condition;
        const hasNew = 'newValue' in condition;
        const operator =
          condition.operator ??
          (!hasOld && !hasNew
            ? 'changed'
            : hasOld && hasNew
              ? 'transition'
              : hasOld
                ? 'changesFrom'
                : 'changesTo');
        const changed = !areChangeLogValuesEqual(oldValue, newValue);
        if (operator === 'changed') return changed;
        if (operator === 'equals') {
          const currentValue =
            condition.scope === 'source' && sourceNew == null
              ? oldValue
              : newValue;
          return this.equal(currentValue, condition.newValue);
        }
        if (operator === 'changesTo')
          return changed && this.equal(newValue, condition.newValue);
        if (operator === 'changesFrom')
          return changed && this.equal(oldValue, condition.oldValue);
        return (
          changed &&
          this.equal(oldValue, condition.oldValue) &&
          this.equal(newValue, condition.newValue)
        );
      }),
    );
  }

  value(input: unknown, path: string): unknown {
    return path
      .split('.')
      .filter(Boolean)
      .reduce<unknown>(
        (current, segment) =>
          current && typeof current === 'object'
            ? (current as Record<string, unknown>)[segment]
            : undefined,
        input,
      );
  }

  private equal(actual: unknown, expected: unknown): boolean {
    const normalize = (value: unknown): unknown =>
      value && typeof value === 'object' && 'handle' in value
        ? (value as { handle?: unknown }).handle
        : value;
    return areChangeLogValuesEqual(normalize(actual), normalize(expected));
  }
}
