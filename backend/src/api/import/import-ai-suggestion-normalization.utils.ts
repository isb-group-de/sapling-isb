import { BadRequestException } from '@nestjs/common';
import { wrap } from '@mikro-orm/core';
import type { ImportValueMappingFallback } from './import.types';

export function parseImportAiJsonObject(
  rawText: string,
): Record<string, unknown> {
  const text = rawText
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '');
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new BadRequestException('import.aiInvalidJsonResponse');
  }

  try {
    const parsed: unknown = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException('import.aiInvalidJsonResponse');
  }
}

export function normalizeImportConfidence(value: unknown): number {
  const confidence = Number(value);
  return Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : 0.5;
}

export function toImportRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === 'object' && !Array.isArray(entry),
      )
    : [];
}

export function toImportStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
    : [];
}

export function normalizeImportRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeImportColumns(columns: string[]): string[] {
  return Array.from(
    new Set(columns.map((column) => column.trim()).filter(Boolean)),
  );
}

export function normalizeImportOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeImportScalarString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return typeof value === 'number' || typeof value === 'boolean'
    ? value.toString().trim()
    : '';
}

export function normalizeImportValueMappingFallback(
  fallback: ImportValueMappingFallback | undefined,
): ImportValueMappingFallback {
  return fallback === 'empty' || fallback === 'error' ? fallback : 'keep';
}

export function toPlainImportRecord(value: object): Record<string, unknown> {
  try {
    return wrap(value).toObject() as Record<string, unknown>;
  } catch {
    return { ...(value as Record<string, unknown>) };
  }
}
