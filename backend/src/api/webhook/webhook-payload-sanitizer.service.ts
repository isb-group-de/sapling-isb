import { Injectable } from '@nestjs/common';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { hasSaplingOption } from '../../entity/global/entity.decorator';
import { TemplateService } from '../template/template.service';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

@Injectable()
export class WebhookPayloadSanitizerService {
  constructor(private readonly templateService: TemplateService) {}

  sanitizeEntityResult<T>(
    entityHandle: string,
    value: T,
    template: EntityTemplateDto[] = this.templateService.getEntityTemplate(
      entityHandle,
    ),
    visited = new WeakMap<object, unknown>(),
    active = new WeakSet<object>(),
  ): T {
    if (Array.isArray(value)) {
      if (visited.has(value)) {
        return (active.has(value) ? [] : visited.get(value)) as T;
      }
      const sanitizedArray: unknown[] = [];
      visited.set(value, sanitizedArray);
      active.add(value);
      try {
        value.forEach((item) => {
          sanitizedArray.push(
            this.sanitizeEntityResult(
              entityHandle,
              item,
              template,
              visited,
              active,
            ),
          );
        });
      } finally {
        active.delete(value);
      }
      return sanitizedArray as T;
    }

    if (this.isCollectionLike(value)) {
      if (!this.isInitializedCollectionLike(value)) return [] as T;
      return this.sanitizeEntityResult(
        entityHandle,
        value.toArray(),
        template,
        visited,
        active,
      ) as T;
    }

    if (typeof value !== 'object' || value === null) return value;
    const cachedValue = visited.get(value);
    if (typeof cachedValue !== 'undefined') {
      return (
        active.has(value)
          ? this.createCircularReferenceFallback(value)
          : cachedValue
      ) as T;
    }

    const record = value as Record<string, unknown>;
    const sanitizedRecord: Record<string, unknown> = {};
    visited.set(value, sanitizedRecord);
    active.add(value);
    const entityClass = ENTITY_MAP[entityHandle] as { prototype?: object };
    const securityFields = template
      .map((field) => field.name)
      .filter(
        (fieldName) =>
          entityClass &&
          typeof entityClass.prototype === 'object' &&
          hasSaplingOption(entityClass.prototype, fieldName, 'isSecurity'),
      );
    const recordKeys = Object.keys(record);
    const templateKeys = template
      .map((field) => field.name)
      .filter(
        (fieldName) => fieldName in record && !recordKeys.includes(fieldName),
      );
    const keys = [...new Set([...recordKeys, ...templateKeys])];

    try {
      for (const key of keys) {
        if (securityFields.includes(key)) continue;
        const field = template.find((entry) => entry.name === key);
        const fieldValue = record[key];
        if (field?.isReference && field.referenceName) {
          sanitizedRecord[key] = this.sanitizeEntityResult(
            field.referenceName,
            fieldValue,
            this.templateService.getEntityTemplate(field.referenceName),
            visited,
            active,
          );
          continue;
        }
        sanitizedRecord[key] = this.sanitizeJsonValue(
          fieldValue,
          visited,
          active,
        );
      }
    } finally {
      active.delete(value);
    }
    return sanitizedRecord as T;
  }

  private sanitizeJsonValue<T>(
    value: T,
    visited: WeakMap<object, unknown>,
    active: WeakSet<object>,
  ): T {
    if (Array.isArray(value)) {
      if (visited.has(value)) {
        return (active.has(value) ? [] : visited.get(value)) as T;
      }
      const sanitizedArray: unknown[] = [];
      visited.set(value, sanitizedArray);
      active.add(value);
      try {
        value.forEach((item) => {
          sanitizedArray.push(this.sanitizeJsonValue(item, visited, active));
        });
      } finally {
        active.delete(value);
      }
      return sanitizedArray as T;
    }
    if (this.isCollectionLike(value)) {
      if (!this.isInitializedCollectionLike(value)) return [] as T;
      return this.sanitizeJsonValue(value.toArray(), visited, active) as T;
    }
    if (typeof value !== 'object' || value === null || value instanceof Date) {
      return value;
    }
    const cachedValue = visited.get(value);
    if (typeof cachedValue !== 'undefined') {
      return (
        active.has(value)
          ? this.createCircularReferenceFallback(value)
          : cachedValue
      ) as T;
    }
    const sanitizedRecord: Record<string, unknown> = {};
    visited.set(value, sanitizedRecord);
    active.add(value);
    try {
      for (const [key, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        sanitizedRecord[key] = this.sanitizeJsonValue(
          nestedValue,
          visited,
          active,
        );
      }
    } finally {
      active.delete(value);
    }
    return sanitizedRecord as T;
  }

  private createCircularReferenceFallback(
    value: object,
  ): Record<string, string | number> | null {
    const handle = this.extractHandleValue(value);
    return typeof handle === 'string' || typeof handle === 'number'
      ? { handle }
      : null;
  }

  private isCollectionLike(value: unknown): value is {
    toArray: () => unknown[];
    isInitialized?: () => boolean;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'toArray' in value &&
      typeof (value as { toArray?: unknown }).toArray === 'function'
    );
  }

  private isInitializedCollectionLike(value: {
    isInitialized?: () => boolean;
  }): boolean {
    return typeof value.isInitialized !== 'function' || value.isInitialized();
  }

  extractHandleValue(value: unknown): string | number | null | undefined {
    if (
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return value;
    }
    if (typeof value !== 'object') return undefined;
    const objectValue = value as Record<string, unknown>;
    if (
      'unwrap' in value &&
      typeof (value as { unwrap?: unknown }).unwrap === 'function'
    ) {
      return this.extractHandleValue(
        (value as { unwrap: () => unknown }).unwrap(),
      );
    }
    if (
      'getEntity' in value &&
      typeof (value as { getEntity?: unknown }).getEntity === 'function'
    ) {
      return this.extractHandleValue(
        (value as { getEntity: () => unknown }).getEntity(),
      );
    }
    if ('handle' in objectValue) {
      const nestedHandle = objectValue.handle;
      if (
        nestedHandle == null ||
        typeof nestedHandle === 'string' ||
        typeof nestedHandle === 'number'
      ) {
        return nestedHandle;
      }
    }
    return undefined;
  }
}
