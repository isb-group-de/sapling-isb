import { Injectable } from '@nestjs/common';
import { hasSaplingOption } from '../../entity/global/entity.decorator';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { PersonItem } from '../../entity/PersonItem';
import { FieldPermissionService } from '../current/field-permission.service';

type SanitizerMetadata = {
  template: EntityTemplateDto[];
  fieldMap: Map<string, EntityTemplateDto>;
  templateFieldNames: string[];
  securityFields: Set<string>;
};

type SanitizerMetadataCache = Map<string, SanitizerMetadata>;

const entityMap = ENTITY_MAP;

@Injectable()
export class GenericSanitizerService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly fieldPermissions: FieldPermissionService = {
      canAccessField: () => true,
    } as unknown as FieldPermissionService,
  ) {}

  projectEntityResult<T>(
    entityHandle: string,
    value: T,
    currentUser: PersonItem,
    template: EntityTemplateDto[] = this.templateService.getEntityTemplate(
      entityHandle,
    ),
  ): T {
    return this.sanitizeEntityResult(
      entityHandle,
      value,
      template,
      new WeakMap(),
      new WeakSet(),
      new Map(),
      currentUser,
    );
  }

  sanitizeEntityResult<T>(
    entityHandle: string,
    value: T,
    template: EntityTemplateDto[] = this.templateService.getEntityTemplate(
      entityHandle,
    ),
    visited = new WeakMap<object, unknown>(),
    active = new WeakSet<object>(),
    sanitizerMetadataCache: SanitizerMetadataCache = new Map(),
    currentUser?: PersonItem,
  ): T {
    const sanitizerMetadata = this.getSanitizerMetadata(
      entityHandle,
      template,
      sanitizerMetadataCache,
    );

    if (Array.isArray(value)) {
      if (visited.has(value)) {
        if (active.has(value)) {
          return [] as T;
        }

        return visited.get(value) as T;
      }

      const sanitizedArray: unknown[] = [];
      visited.set(value, sanitizedArray);

      active.add(value);
      try {
        value.forEach((item) => {
          const itemVisited = new WeakMap<object, unknown>([
            [value, sanitizedArray],
          ]);
          const itemActive = new WeakSet<object>([value]);

          sanitizedArray.push(
            this.sanitizeEntityResult(
              entityHandle,
              item,
              sanitizerMetadata.template,
              itemVisited,
              itemActive,
              sanitizerMetadataCache,
              currentUser,
            ),
          );
        });
      } finally {
        active.delete(value);
      }

      return sanitizedArray as T;
    }

    if (this.isCollectionLike(value)) {
      if (!this.isInitializedCollectionLike(value)) {
        return [] as T;
      }

      return this.sanitizeEntityResult(
        entityHandle,
        value.toArray(),
        sanitizerMetadata.template,
        visited,
        active,
        sanitizerMetadataCache,
        currentUser,
      ) as T;
    }

    if (typeof value !== 'object' || value === null) {
      return value;
    }

    const cachedValue = visited.get(value);
    if (typeof cachedValue !== 'undefined') {
      if (active.has(value)) {
        return this.createCircularReferenceFallback(
          value,
          currentUser,
          entityHandle,
          sanitizerMetadata,
        ) as T;
      }

      return cachedValue as T;
    }

    const record = value as Record<string, unknown>;
    const sanitizedRecord: Record<string, unknown> = {};
    visited.set(value, sanitizedRecord);
    active.add(value);

    const recordKeys = Object.keys(record);
    const templateKeys = sanitizerMetadata.templateFieldNames.filter(
      (fieldName) => fieldName in record && !recordKeys.includes(fieldName),
    );
    const keys = [...new Set([...recordKeys, ...templateKeys])];

    try {
      for (const key of keys) {
        if (sanitizerMetadata.securityFields.has(key)) {
          continue;
        }

        const field =
          sanitizerMetadata.fieldMap.get(key) ??
          this.createCustomFieldTemplate(key);
        const fieldValue = record[key];

        if (
          key === 'customFields' &&
          fieldValue &&
          typeof fieldValue === 'object' &&
          !Array.isArray(fieldValue)
        ) {
          const visibleCustomFields: Record<string, unknown> = {};
          for (const [customKey, customValue] of Object.entries(fieldValue)) {
            const customField =
              sanitizerMetadata.fieldMap.get(`customFields.${customKey}`) ??
              this.createCustomFieldTemplate(`customFields.${customKey}`);
            if (
              !currentUser ||
              (customField &&
                this.fieldPermissions.canAccessField(
                  currentUser,
                  entityHandle,
                  customField,
                  'read',
                  record,
                  sanitizerMetadata.template,
                ))
            ) {
              visibleCustomFields[customKey] = customValue;
            }
          }
          sanitizedRecord[key] = visibleCustomFields;
          continue;
        }

        if (
          currentUser &&
          field &&
          !this.fieldPermissions.canAccessField(
            currentUser,
            entityHandle,
            field,
            'read',
            record,
            sanitizerMetadata.template,
          )
        ) {
          continue;
        }

        if (field?.isReference && field.referenceName) {
          sanitizedRecord[key] = this.sanitizeEntityResult(
            field.referenceName,
            fieldValue,
            undefined,
            visited,
            active,
            sanitizerMetadataCache,
            currentUser,
          );
          continue;
        }

        sanitizedRecord[key] = fieldValue;
      }
    } finally {
      active.delete(value);
    }

    return sanitizedRecord as T;
  }

  private createCustomFieldTemplate(
    fieldName: string,
  ): EntityTemplateDto | undefined {
    if (!fieldName.startsWith('customFields.')) return undefined;
    return {
      name: fieldName,
      options: [],
      isPersistent: true,
    } as unknown as EntityTemplateDto;
  }

  private getSanitizerMetadata(
    entityHandle: string,
    template?: EntityTemplateDto[],
    sanitizerMetadataCache: SanitizerMetadataCache = new Map(),
  ): SanitizerMetadata {
    const cachedMetadata = sanitizerMetadataCache.get(entityHandle);
    if (cachedMetadata) {
      return cachedMetadata;
    }

    const resolvedTemplate =
      template ?? this.templateService.getEntityTemplate(entityHandle);
    const entityClass = entityMap[entityHandle] as { prototype?: object };
    const fieldMap = new Map<string, EntityTemplateDto>();
    const templateFieldNames: string[] = [];
    const securityFields = new Set<string>();

    for (const field of resolvedTemplate) {
      fieldMap.set(field.name, field);
      templateFieldNames.push(field.name);

      if (
        entityClass &&
        typeof entityClass.prototype === 'object' &&
        hasSaplingOption(entityClass.prototype, field.name, 'isSecurity')
      ) {
        securityFields.add(field.name);
      }
    }

    const metadata: SanitizerMetadata = {
      template: resolvedTemplate,
      fieldMap,
      templateFieldNames,
      securityFields,
    };
    sanitizerMetadataCache.set(entityHandle, metadata);
    return metadata;
  }

  private createCircularReferenceFallback(
    value: object,
    currentUser?: PersonItem,
    entityHandle?: string,
    metadata?: SanitizerMetadata,
  ): Record<string, string | number> | null {
    const handle = this.extractHandleValue(value);

    if (currentUser && entityHandle && metadata) {
      const identifierField =
        metadata.fieldMap.get('handle') ??
        metadata.template.find((field) => field.isPrimaryKey);
      if (
        !identifierField ||
        !this.fieldPermissions.canAccessField(
          currentUser,
          entityHandle,
          identifierField,
          'read',
          value as Record<string, unknown>,
          metadata.template,
        )
      ) {
        return null;
      }
    }

    if (typeof handle === 'string' || typeof handle === 'number') {
      return { handle };
    }

    return null;
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

  private extractHandleValue(
    value: unknown,
  ): string | number | null | undefined {
    if (
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return value;
    }

    if (typeof value !== 'object') {
      return undefined;
    }

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
