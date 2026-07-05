import { Injectable } from '@nestjs/common';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { normalizeBoolean } from './generic-import.util';
import { GenericReferenceService } from './generic-reference.service';
import { GenericChangeLogService } from './generic-change-log.service';
import {
  areUpdateConflictValuesEqual,
  asChangeLogRecord,
  mergeChangeLogPayloadShape,
  normalizeConcurrencyBasePayload,
  normalizeConcurrencyTimestamp,
  normalizeUpdateConflictValue,
  projectChangeLogPayload,
  type ChangeLogPayload,
} from './generic-change-log.util';

type GenericUpdatePayload = {
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
};

export type GenericUpdateConcurrencyResolution =
  | 'detect'
  | 'merge'
  | 'overwrite';

export type GenericUpdateConcurrencyOptions = {
  expectedUpdatedAt?: string | Date | null;
  basePayload?: Record<string, unknown> | null;
  resolution?: GenericUpdateConcurrencyResolution;
  merge?: boolean;
};

export type NormalizedUpdateConcurrencyMetadata = {
  expectedUpdatedAt?: string | null;
  basePayload?: ChangeLogPayload;
  resolution?: GenericUpdateConcurrencyResolution;
};

export type UpdateConflictField = {
  property: string;
  baseValue: unknown;
  currentValue: unknown;
  attemptedValue: unknown;
  changedInCurrent: boolean;
  changedInAttempt: boolean;
  conflict: boolean;
};

export type UpdateConflictEvaluation = {
  stale: boolean;
  expectedUpdatedAt: string | null;
  currentUpdatedAt: string | null;
  basePayload: ChangeLogPayload;
  currentPayload: ChangeLogPayload;
  attemptedPayload: ChangeLogPayload;
  fields: UpdateConflictField[];
  conflictingProperties: string[];
  mergeableProperties: string[];
};

const GENERIC_CONCURRENCY_METADATA_KEY = '_saplingConcurrency';
const UPDATE_CONFLICT_IGNORED_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  GENERIC_CONCURRENCY_METADATA_KEY,
]);

@Injectable()
export class GenericUpdateConflictService {
  constructor(
    private readonly genericChangeLogService: GenericChangeLogService,
    private readonly genericReferenceService: GenericReferenceService,
  ) {}

  extractConcurrencyMetadata(
    data: GenericUpdatePayload,
    options: GenericUpdateConcurrencyOptions = {},
  ): {
    data: GenericUpdatePayload;
    concurrency: NormalizedUpdateConcurrencyMetadata;
  } {
    const nextData = { ...data };
    const rawMetadata = this.asUnknownRecord(
      nextData[GENERIC_CONCURRENCY_METADATA_KEY],
    );
    delete nextData[GENERIC_CONCURRENCY_METADATA_KEY];

    const metadata: Record<string, unknown> = {
      ...(rawMetadata ?? {}),
    };

    if (metadata.expectedUpdatedAt == null && metadata.baseUpdatedAt != null) {
      metadata.expectedUpdatedAt = metadata.baseUpdatedAt;
    }

    if (metadata.expectedUpdatedAt == null && nextData.updatedAt != null) {
      metadata.expectedUpdatedAt = nextData.updatedAt;
    }
    delete nextData.updatedAt;

    if (options.expectedUpdatedAt !== undefined) {
      metadata.expectedUpdatedAt = options.expectedUpdatedAt;
    }

    if (options.basePayload !== undefined) {
      metadata.basePayload = options.basePayload;
    }

    if (options.resolution) {
      metadata.resolution = options.resolution;
    }

    if (options.merge === true) {
      metadata.resolution = 'merge';
    }

    const mergeRequested = normalizeBoolean(metadata.merge);
    const forceRequested = normalizeBoolean(metadata.force);
    const resolution =
      forceRequested === true
        ? 'overwrite'
        : mergeRequested === true
          ? 'merge'
          : this.normalizeConcurrencyResolution(metadata.resolution);

    return {
      data: nextData,
      concurrency: {
        expectedUpdatedAt: normalizeConcurrencyTimestamp(
          metadata.expectedUpdatedAt,
        ),
        basePayload: normalizeConcurrencyBasePayload(metadata.basePayload),
        resolution,
      },
    };
  }

  evaluate(
    entityHandle: string,
    item: object,
    template: EntityTemplateDto[],
    attemptedPayload: ChangeLogPayload,
    concurrency: NormalizedUpdateConcurrencyMetadata,
  ): UpdateConflictEvaluation {
    const expectedUpdatedAt = concurrency.expectedUpdatedAt ?? null;
    const currentUpdatedAt = normalizeConcurrencyTimestamp(
      (item as { updatedAt?: unknown }).updatedAt,
    );
    const basePayload = this.projectUpdateConflictPayload(
      template,
      concurrency.basePayload ?? null,
    );
    const attemptedConflictPayload = this.projectUpdateConflictPayload(
      template,
      attemptedPayload,
    );
    const comparisonShape = mergeChangeLogPayloadShape(
      basePayload,
      attemptedConflictPayload,
    );
    const currentPayload = comparisonShape
      ? this.genericChangeLogService.captureEntityChangeLogPayload(
          entityHandle,
          item,
          template,
          comparisonShape,
        )
      : null;
    const stale =
      expectedUpdatedAt != null &&
      currentUpdatedAt != null &&
      expectedUpdatedAt !== currentUpdatedAt;
    const fields = stale
      ? this.buildUpdateConflictFields(
          basePayload,
          currentPayload,
          attemptedConflictPayload,
        )
      : [];
    const conflictingProperties = fields
      .filter((field) => field.conflict)
      .map((field) => field.property);
    const mergeableProperties = fields
      .filter((field) => field.changedInAttempt && !field.conflict)
      .map((field) => field.property);

    return {
      stale,
      expectedUpdatedAt,
      currentUpdatedAt,
      basePayload,
      currentPayload,
      attemptedPayload: attemptedConflictPayload,
      fields,
      conflictingProperties,
      mergeableProperties,
    };
  }

  buildAutomaticMergePayload(
    data: GenericUpdatePayload,
    conflict: UpdateConflictEvaluation,
  ): GenericUpdatePayload {
    const mergeableProperties = new Set(conflict.mergeableProperties);
    const mergedData = Object.fromEntries(
      Object.entries(data).filter(([key]) => mergeableProperties.has(key)),
    ) as { createdAt?: Date; updatedAt?: Date } & Record<string, unknown>;
    const dataRecord = data as Record<string, unknown>;

    if (
      !this.hasOwnRecordProperty(mergedData, 'handle') &&
      this.hasOwnRecordProperty(dataRecord, 'handle')
    ) {
      mergedData.handle = dataRecord.handle;
    }

    return mergedData;
  }

  async buildExceptionBody(
    entityHandle: string,
    handle: string | number,
    conflict: UpdateConflictEvaluation,
  ): Promise<Record<string, unknown>> {
    const normalizedHandle = this.genericReferenceService.normalizeHandleValue(
      entityHandle,
      handle,
    );
    const current = {
      ...asChangeLogRecord(conflict.currentPayload),
      handle: normalizedHandle,
      updatedAt: conflict.currentUpdatedAt,
    };

    return {
      message: 'exception.concurrentUpdate',
      error: 'Der Datensatz wurde seit dem Oeffnen geaendert.',
      details: {
        summary:
          'Der Datensatz wurde inzwischen von einer anderen Person geaendert. Bitte pruefe die Aenderungen und fuehre sie zusammen.',
        reason: 'staleRecord',
        entityHandle,
        handle: normalizedHandle,
        expectedUpdatedAt: conflict.expectedUpdatedAt,
        currentUpdatedAt: conflict.currentUpdatedAt,
        autoMergeable: conflict.conflictingProperties.length === 0,
        conflictingProperties: conflict.conflictingProperties,
        mergeableProperties: conflict.mergeableProperties,
        base: conflict.basePayload,
        current,
        attempted: conflict.attemptedPayload,
        fields: conflict.fields,
        latestChange: await this.genericChangeLogService.findLatestChange(
          entityHandle,
          normalizedHandle,
        ),
      },
      technical: {
        operation: 'generic.update',
        entityHandle,
        handle: normalizedHandle,
        expectedUpdatedAt: conflict.expectedUpdatedAt,
        currentUpdatedAt: conflict.currentUpdatedAt,
      },
    };
  }

  private buildUpdateConflictFields(
    basePayload: ChangeLogPayload,
    currentPayload: ChangeLogPayload,
    attemptedPayload: ChangeLogPayload,
  ): UpdateConflictField[] {
    const baseRecord = asChangeLogRecord(basePayload);
    const currentRecord = asChangeLogRecord(currentPayload);
    const attemptedRecord = asChangeLogRecord(attemptedPayload);
    const hasBasePayload = basePayload != null;
    const propertyNames = new Set([
      ...Object.keys(baseRecord),
      ...Object.keys(attemptedRecord),
    ]);

    return [...propertyNames]
      .filter((property) => !UPDATE_CONFLICT_IGNORED_FIELDS.has(property))
      .sort((left, right) => left.localeCompare(right))
      .map((property) => {
        const attemptedHasProperty = this.hasOwnRecordProperty(
          attemptedRecord,
          property,
        );
        const baseValue = normalizeUpdateConflictValue(baseRecord[property]);
        const currentValue = normalizeUpdateConflictValue(
          currentRecord[property],
        );
        const attemptedValue = attemptedHasProperty
          ? normalizeUpdateConflictValue(attemptedRecord[property])
          : baseValue;
        const changedInAttempt = hasBasePayload
          ? !areUpdateConflictValuesEqual(baseValue, attemptedValue)
          : attemptedHasProperty;
        const changedInCurrent = hasBasePayload
          ? !areUpdateConflictValuesEqual(baseValue, currentValue)
          : !areUpdateConflictValuesEqual(currentValue, attemptedValue);
        const conflict =
          changedInAttempt &&
          changedInCurrent &&
          !areUpdateConflictValuesEqual(currentValue, attemptedValue);

        return {
          property,
          baseValue,
          currentValue,
          attemptedValue,
          changedInCurrent,
          changedInAttempt,
          conflict,
        };
      })
      .filter(
        (field) =>
          field.changedInCurrent || field.changedInAttempt || field.conflict,
      );
  }

  private projectUpdateConflictPayload(
    template: EntityTemplateDto[],
    payload: ChangeLogPayload,
  ): ChangeLogPayload {
    if (!payload) {
      return null;
    }

    const comparableTemplate = template.filter((field) =>
      this.isUpdateConflictComparableField(field),
    );
    const comparableFieldNames = new Set(
      comparableTemplate
        .map((field) => field.name)
        .filter((name): name is string => typeof name === 'string'),
    );
    const sourceRecord = asChangeLogRecord(payload);
    const comparablePayload = Object.fromEntries(
      Object.entries(sourceRecord).filter(([key]) =>
        comparableFieldNames.has(key),
      ),
    );

    if (Object.keys(comparablePayload).length === 0) {
      return null;
    }

    return projectChangeLogPayload(comparableTemplate, comparablePayload);
  }

  private isUpdateConflictComparableField(field: EntityTemplateDto): boolean {
    if (!field.name || field.isPersistent === false) {
      return false;
    }

    if (field.kind === 'm:1') {
      return true;
    }

    if (field.isReference) {
      return false;
    }

    return !['1:m', 'm:n', 'n:m', '1:1'].includes(field.kind ?? '');
  }

  private normalizeConcurrencyResolution(
    value: unknown,
  ): GenericUpdateConcurrencyResolution | undefined {
    return value === 'merge' || value === 'overwrite' || value === 'detect'
      ? value
      : undefined;
  }

  private asUnknownRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private hasOwnRecordProperty(record: object, property: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(record, property) === true;
  }
}
