import { ForbiddenException, Injectable } from '@nestjs/common';
import type { McpToolPolicy } from './mcp-policy.types';
@Injectable()
export class SaplingMcpValueService {
  asStringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  asEntityRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  }

  asCollectionRecords(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object',
      );
    }

    if (
      value &&
      typeof value === 'object' &&
      'getItems' in (value as Record<string, unknown>)
    ) {
      const items = (value as { getItems: () => unknown[] }).getItems();
      return items.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object',
      );
    }

    return [];
  }

  asPrimitive(value: unknown): string | number | boolean | null {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    return null;
  }

  asResultHandle(value: unknown): string | number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return null;
  }

  asScore(value: unknown): number {
    const score = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(score) ? score : 0;
  }

  asTicketSearchMode(value: unknown): 'all' | 'problem' | 'solution' {
    return value === 'problem' || value === 'solution' ? value : 'all';
  }

  asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  asRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
      ? value
          .map((item) => this.asRecord(item))
          .filter((item) => Object.keys(item).length > 0)
      : [];
  }

  asFieldMappingArray(value: unknown): Record<string, unknown>[] {
    const arrayValue = this.asRecordArray(value);

    if (arrayValue.length > 0) {
      return arrayValue;
    }

    const recordValue = this.asRecord(value);

    const mappings: Record<string, unknown>[] = [];

    for (const [left, right] of Object.entries(recordValue)) {
      if (typeof right !== 'string' || !right.trim()) {
        continue;
      }

      const sourceColumn = left.trim();
      const targetField = right.trim();

      if (!sourceColumn || !targetField) {
        continue;
      }

      mappings.push({ sourceColumn, targetField });
    }

    return mappings;
  }

  withImplicitHandleMapping(
    mappings: Record<string, unknown>[],
    headers: unknown,
  ): Record<string, unknown>[] {
    const headerNames = this.asStringArray(headers);
    const hasHandleHeader = headerNames.some(
      (header) => header.trim().toLowerCase() === 'handle',
    );

    if (!hasHandleHeader) {
      return mappings;
    }

    const hasHandleMapping = mappings.some((mapping) => {
      const sourceColumn = this.asStringValue(mapping.sourceColumn);
      const targetField = this.asStringValue(mapping.targetField);
      return (
        sourceColumn?.toLowerCase() === 'handle' ||
        targetField?.toLowerCase() === 'handle'
      );
    });

    return hasHandleMapping
      ? mappings
      : [{ sourceColumn: 'handle', targetField: 'handle' }, ...mappings];
  }

  asStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  assertInternalToolAllowed(toolName: string, policy?: McpToolPolicy): void {
    if (this.matchesAllowList(policy?.allowedInternalTools, toolName)) {
      return;
    }

    throw new ForbiddenException('ai.agentToolNotAllowed');
  }

  assertEntityAllowed(entityHandle: string, policy?: McpToolPolicy): void {
    if (this.isEntityAllowed(entityHandle, policy)) {
      return;
    }

    throw new ForbiddenException(`ai.agentEntityNotAllowed:${entityHandle}`);
  }

  isEntityAllowed(entityHandle: string, policy?: McpToolPolicy): boolean {
    return this.matchesAllowList(policy?.allowedEntityHandles, entityHandle);
  }

  filterPolicyEntityHandles(
    entityHandles: string[],
    policy?: McpToolPolicy,
  ): string[] {
    return entityHandles.filter((entityHandle) =>
      this.isEntityAllowed(entityHandle, policy),
    );
  }

  matchesAllowList(
    allowList: string[] | null | undefined,
    candidate: string,
  ): boolean {
    const normalizedAllowList = this.normalizeStringList(allowList);

    if (normalizedAllowList.length === 0) {
      return true;
    }

    return normalizedAllowList.includes(candidate.trim().toLowerCase());
  }

  normalizeStringList(value: string[] | null | undefined): string[] {
    return (value ?? [])
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  asPositiveNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.trunc(value)
      : null;
  }

  requireStringArg(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ForbiddenException(`ai.mcp${fieldName}Missing`);
    }

    return value.trim();
  }

  requireHandleArg(value: unknown, fieldName: string): string | number {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    throw new ForbiddenException(`ai.mcp${fieldName}Missing`);
  }

  requirePositiveIntArg(value: unknown, fieldName: string): number {
    const normalized = this.asPositiveNumber(value);

    if (normalized == null) {
      throw new ForbiddenException(`ai.mcp${fieldName}Missing`);
    }

    return normalized;
  }
}
