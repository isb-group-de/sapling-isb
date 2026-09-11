import { Injectable } from '@nestjs/common';
import { GENERIC_LIST_MAX_LIMIT } from '../../constants/project.constants';
import { PersonItem } from '../../entity/PersonItem';
import { CurrentService } from '../current/current.service';
import { GenericService } from '../generic/generic.service';
import type { McpToolPolicy } from './mcp-policy.types';
import { SAPLING_MCP_USAGE_HINTS } from './prompts/sapling-mcp.prompts';
import { SaplingMcpCriteriaRepairRequest } from './sapling-mcp-criteria.types';
import { SaplingMcpCriteriaService } from './sapling-mcp-criteria.service';
import { SaplingMcpMetadataService } from './sapling-mcp-metadata.service';
import { SaplingMcpPermissionService } from './sapling-mcp-permission.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
import { SaplingMcpReferenceValueService } from './sapling-mcp-reference-value.service';
@Injectable()
export class SaplingMcpGenericToolService {
  constructor(
    private readonly genericService: GenericService,
    private readonly currentService: CurrentService,
    private readonly criteriaService: SaplingMcpCriteriaService,
    private readonly permissionService: SaplingMcpPermissionService,
    private readonly metadata: SaplingMcpMetadataService,
    private readonly values: SaplingMcpValueService,
    private readonly referenceValues: SaplingMcpReferenceValueService = new SaplingMcpReferenceValueService(
      currentService,
      metadata,
      values,
    ),
  ) {}
  async executeGenericList(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      'allowRead',
    );
    let filter: Record<string, unknown>;
    let orderBy: Record<string, unknown>;

    try {
      filter = this.criteriaService.normalizeEntityCriteria(
        entityHandle,
        this.values.asRecord(args.filter),
      );
      orderBy = this.criteriaService.normalizeEntitySort(
        entityHandle,
        this.values.asRecord(args.orderBy),
      );
    } catch (error) {
      if (error instanceof SaplingMcpCriteriaRepairRequest) {
        return this.criteriaService.createCriteriaRepairResult(
          entityHandle,
          error,
        );
      }

      throw error;
    }

    const relations = this.criteriaService.normalizeEntityRelations(
      entityHandle,
      this.values.asStringArray(args.relations),
    );
    const page = this.values.asPositiveNumber(args.page) ?? 1;
    const limit = Math.min(
      this.values.asPositiveNumber(args.limit) ?? 50,
      GENERIC_LIST_MAX_LIMIT,
    );

    return this.genericService.findAndCount(
      entityHandle,
      filter,
      page,
      limit,
      orderBy,
      user,
      relations,
    );
  }

  async executeGenericGet(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      'allowRead',
    );
    const handle = this.values.requireHandleArg(args.handle, 'handle');
    const relations = this.criteriaService.normalizeEntityRelations(
      entityHandle,
      this.values.asStringArray(args.relations),
    );
    const result = await this.genericService.findAndCount(
      entityHandle,
      { handle },
      1,
      1,
      {},
      user,
      relations,
    );
    const record = Array.isArray((result as { data?: unknown[] }).data)
      ? ((result as { data: unknown[] }).data[0] ?? null)
      : null;
    const resolvedHandle =
      record && typeof record === 'object'
        ? this.values.asPrimitive((record as { handle?: unknown }).handle)
        : null;

    return {
      entityHandle,
      ...(resolvedHandle !== null ? { handle: resolvedHandle } : {}),
      found: record != null,
      record,
      usageHints: [...SAPLING_MCP_USAGE_HINTS.genericGet],
    };
  }

  async executeGenericTimeline(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      'allowRead',
    );
    const handle = this.values.requireHandleArg(args.handle, 'handle');
    const before =
      typeof args.before === 'string' && args.before.trim()
        ? args.before.trim()
        : undefined;
    const months = Math.min(this.values.asPositiveNumber(args.months) ?? 6, 12);

    return this.genericService.getRecordTimeline(
      entityHandle,
      handle,
      user,
      before,
      months,
    );
  }

  async executeGenericCreate(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const repair = await this.preflightGenericMutation(
      'generic_create',
      args,
      user,
      policy,
    );
    if (repair) {
      return repair;
    }

    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      'allowInsert',
    );
    const data = this.metadata.stripSecurityFields(
      entityHandle,
      this.values.asRecord(args.data),
    );
    const defaultedData = await this.referenceValues.applyCurrentDefaults(
      entityHandle,
      data,
      user,
    );
    const normalizedData = this.referenceValues.normalizeMutationReferences(
      entityHandle,
      defaultedData,
    );
    return this.genericService.create(entityHandle, normalizedData, user);
  }

  async executeGenericUpdate(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const repair = await this.preflightGenericMutation(
      'generic_update',
      args,
      user,
      policy,
    );
    if (repair) {
      return repair;
    }

    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      'allowUpdate',
    );
    const handle = this.values.requireHandleArg(args.handle, 'handle');
    const data = this.metadata.stripSecurityFields(
      entityHandle,
      this.values.asRecord(args.data),
    );
    const normalizedData = this.referenceValues.normalizeMutationReferences(
      entityHandle,
      data,
    );
    const relations = this.values.asStringArray(args.relations);

    return this.genericService.update(
      entityHandle,
      handle,
      normalizedData,
      user,
      relations,
    );
  }

  async preflightGenericMutation(
    toolName: 'generic_create' | 'generic_update',
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<Record<string, unknown> | null> {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    const permission =
      toolName === 'generic_create' ? 'allowInsert' : 'allowUpdate';
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      permission,
    );
    if (toolName === 'generic_update') {
      this.values.requireHandleArg(args.handle, 'handle');
    }

    const submittedData = this.metadata.stripSecurityFields(
      entityHandle,
      this.values.asRecord(args.data),
    );
    const data =
      toolName === 'generic_create'
        ? await this.referenceValues.applyCurrentDefaults(
            entityHandle,
            submittedData,
            user,
          )
        : submittedData;
    const schema = await this.metadata.executeEntitySchema(
      { entityHandle },
      policy,
      user,
    );
    const accessKey =
      toolName === 'generic_create' ? 'allowInsert' : 'allowUpdate';
    const writableFields = schema.fields.filter(
      (field) =>
        field.fieldAccess?.[accessKey] !== false &&
        !field.isAutoIncrement &&
        !field.options.includes('isReadOnly') &&
        !field.options.includes('isSystem'),
    );
    const writableByName = new Map(
      writableFields.map((field) => [field.name, field]),
    );
    const supportsNestedCustomFields = writableFields.some((field) =>
      field.name.startsWith('customFields.'),
    );
    const invalidFields = Object.keys(data)
      .filter(
        (fieldName) =>
          !writableByName.has(fieldName) &&
          !(fieldName === 'customFields' && supportsNestedCustomFields),
      )
      .map((fieldName) => ({ fieldName, reason: 'unknownOrNotWritable' }));
    const missingRequiredFields =
      toolName === 'generic_create'
        ? writableFields
            .filter(
              (field) =>
                field.isRequired &&
                !this.hasRequiredMutationPayloadValue(data, field.name),
            )
            .map((field) => field.name)
        : [];
    const invalidValues: Array<Record<string, unknown>> = [];
    const invalidReferences: Array<Record<string, unknown>> = [];

    for (const [fieldName, value] of Object.entries(data)) {
      const field = writableByName.get(fieldName);
      if (!field || value == null) {
        continue;
      }

      if (
        field.isReference &&
        field.referenceName &&
        (field.kind === 'm:1' || field.kind === '1:1')
      ) {
        const submittedValue = this.extractReferenceHandle(value);

        if (
          (typeof submittedValue !== 'string' || !submittedValue.trim()) &&
          (typeof submittedValue !== 'number' ||
            !Number.isFinite(submittedValue))
        ) {
          invalidReferences.push({
            fieldName,
            referenceName: field.referenceName,
            handleField: 'handle',
            reason: 'referenceHandleRequired',
          });
          continue;
        }

        const referenceHandleType = field.referenceHandleType?.toLowerCase();
        if (
          referenceHandleType &&
          [
            'number',
            'float',
            'double',
            'decimal',
            'real',
            'int',
            'integer',
            'smallint',
            'bigint',
          ].includes(referenceHandleType) &&
          (typeof submittedValue === 'boolean' ||
            !Number.isFinite(Number(submittedValue)))
        ) {
          invalidReferences.push({
            fieldName,
            referenceName: field.referenceName,
            handleField: 'handle',
            expectedType: referenceHandleType,
            submittedValue,
            reason: 'referenceHandleTypeMismatch',
          });
          continue;
        }

        try {
          const referencedRecord = (await this.executeGenericGet(
            {
              entityHandle: field.referenceName,
              handle: submittedValue,
              relations: this.getDependencyRelations(field),
            },
            user,
            policy,
          )) as { found?: unknown; record?: unknown };

          if (referencedRecord.found !== true) {
            invalidReferences.push({
              fieldName,
              referenceName: field.referenceName,
              handleField: 'handle',
              submittedValue,
              reason: 'referenceRecordNotFound',
            });
          } else {
            this.validateReferenceDependency(
              entityHandle,
              field,
              data,
              submittedValue,
              referencedRecord.record,
              invalidReferences,
            );
          }
        } catch {
          invalidReferences.push({
            fieldName,
            referenceName: field.referenceName,
            handleField: 'handle',
            submittedValue,
            reason: 'referenceCouldNotBeValidated',
          });
        }
        continue;
      }

      if (
        field.isReference &&
        field.referenceName &&
        (field.kind === 'm:n' || field.kind === 'n:m')
      ) {
        await this.validateReferenceCollection(
          field,
          value,
          user,
          policy,
          invalidReferences,
        );
        continue;
      }

      const normalizedType = field.type.toLowerCase();
      if (
        [
          'number',
          'float',
          'double',
          'decimal',
          'real',
          'int',
          'integer',
          'smallint',
          'bigint',
        ].includes(normalizedType) &&
        (typeof value === 'boolean' ||
          value === '' ||
          !Number.isFinite(Number(value)))
      ) {
        invalidValues.push({
          fieldName,
          expectedType: field.type,
          submittedValue: value,
          reason: 'invalidNumericValue',
        });
      }
    }

    if (
      invalidFields.length === 0 &&
      missingRequiredFields.length === 0 &&
      invalidValues.length === 0 &&
      invalidReferences.length === 0
    ) {
      return null;
    }

    return {
      entityHandle,
      toolName,
      queryExecuted: false,
      mutationExecuted: false,
      pendingToolAction: false,
      status: 'needs_schema_retry',
      invalidFields,
      missingRequiredFields,
      invalidValues,
      invalidReferences,
      validFields: writableFields.map((field) => field.name),
      usageHints: [...SAPLING_MCP_USAGE_HINTS.mutationRepair],
    };
  }

  private hasRequiredMutationPayloadValue(
    data: Record<string, unknown>,
    fieldName: string,
  ): boolean {
    if (Object.prototype.hasOwnProperty.call(data, fieldName)) {
      return data[fieldName] != null;
    }

    if (!fieldName.startsWith('customFields.')) {
      return false;
    }

    const customFields = this.values.asRecord(data.customFields);
    const customFieldName = fieldName.slice('customFields.'.length);
    return (
      Object.hasOwn(customFields, customFieldName) &&
      customFields[customFieldName] != null
    );
  }

  private async validateReferenceCollection(
    field: {
      name: string;
      referenceName: string;
      referenceHandleType: string | null;
    },
    value: unknown,
    user: PersonItem,
    policy: McpToolPolicy | undefined,
    invalidReferences: Array<Record<string, unknown>>,
  ): Promise<void> {
    if (!Array.isArray(value)) {
      invalidReferences.push({
        fieldName: field.name,
        referenceName: field.referenceName,
        reason: 'referenceHandleArrayRequired',
      });
      return;
    }

    for (const [index, entry] of value.entries()) {
      const submittedValue = this.extractReferenceHandle(entry);
      if (
        !this.isValidReferenceHandle(submittedValue, field.referenceHandleType)
      ) {
        invalidReferences.push({
          fieldName: field.name,
          referenceName: field.referenceName,
          itemIndex: index,
          submittedValue,
          reason: 'referenceHandleRequired',
        });
        continue;
      }

      try {
        const referencedRecord = (await this.executeGenericGet(
          {
            entityHandle: field.referenceName,
            handle: submittedValue,
          },
          user,
          policy,
        )) as { found?: unknown };

        if (referencedRecord.found !== true) {
          invalidReferences.push({
            fieldName: field.name,
            referenceName: field.referenceName,
            itemIndex: index,
            submittedValue,
            reason: 'referenceRecordNotFound',
          });
        }
      } catch {
        invalidReferences.push({
          fieldName: field.name,
          referenceName: field.referenceName,
          itemIndex: index,
          submittedValue,
          reason: 'referenceCouldNotBeValidated',
        });
      }
    }
  }

  private validateReferenceDependency(
    entityHandle: string,
    field: {
      name: string;
      referenceName: string;
      referenceDependency?: Record<string, unknown> | null;
    },
    data: Record<string, unknown>,
    submittedValue: unknown,
    referencedRecord: unknown,
    invalidReferences: Array<Record<string, unknown>>,
  ): void {
    const dependency = field.referenceDependency;
    const parentFieldName =
      typeof dependency?.parentField === 'string'
        ? dependency.parentField
        : null;
    const targetFieldName =
      typeof dependency?.targetField === 'string'
        ? dependency.targetField
        : null;

    if (!parentFieldName || !targetFieldName) {
      return;
    }

    // Generic reference validation has a ticket-specific compatibility rule
    // for event creators. Leave that exceptional case to the authoritative
    // validator instead of rejecting a valid ticket-derived event here.
    if (
      entityHandle === 'event' &&
      field.name === 'creatorPerson' &&
      parentFieldName === 'creatorCompany' &&
      data.ticket != null
    ) {
      return;
    }

    const parentValue = this.extractReferenceHandle(data[parentFieldName]);
    if (parentValue == null) {
      if (dependency?.requireParent === true) {
        invalidReferences.push({
          fieldName: field.name,
          referenceName: field.referenceName,
          submittedValue,
          parentFieldName,
          reason: 'referenceDependencyParentRequired',
        });
      }
      return;
    }

    const record =
      referencedRecord &&
      typeof referencedRecord === 'object' &&
      !Array.isArray(referencedRecord)
        ? (referencedRecord as Record<string, unknown>)
        : null;
    const targetValue = this.extractReferenceHandle(record?.[targetFieldName]);

    if (
      targetValue == null ||
      !this.areReferenceHandlesEqual(parentValue, targetValue)
    ) {
      invalidReferences.push({
        fieldName: field.name,
        referenceName: field.referenceName,
        submittedValue,
        parentFieldName,
        parentSubmittedValue: parentValue,
        targetFieldName,
        targetValue,
        reason:
          targetValue == null
            ? 'referenceDependencyCouldNotBeValidated'
            : 'referenceDependencyMismatch',
      });
    }
  }

  private getDependencyRelations(field: {
    referenceDependency?: Record<string, unknown> | null;
  }): string[] {
    const targetField = field.referenceDependency?.targetField;
    return typeof targetField === 'string' && targetField.trim()
      ? [targetField]
      : [];
  }

  private extractReferenceHandle(value: unknown): unknown {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>).handle
      : value;
  }

  private areReferenceHandlesEqual(left: unknown, right: unknown): boolean {
    const isPrimitiveHandle = (value: unknown): value is string | number =>
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value));

    return (
      isPrimitiveHandle(left) &&
      isPrimitiveHandle(right) &&
      String(left) === String(right)
    );
  }

  private isValidReferenceHandle(
    value: unknown,
    referenceHandleType: string | null,
  ): value is string | number {
    if (
      (typeof value !== 'string' || !value.trim()) &&
      (typeof value !== 'number' || !Number.isFinite(value))
    ) {
      return false;
    }

    const normalizedType = referenceHandleType?.toLowerCase();
    if (
      normalizedType &&
      [
        'number',
        'float',
        'double',
        'decimal',
        'real',
        'int',
        'integer',
        'smallint',
        'bigint',
      ].includes(normalizedType)
    ) {
      return Number.isFinite(Number(value));
    }

    return true;
  }

  async executeGenericDelete(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    const entityHandle = this.values.requireStringArg(
      args.entityHandle,
      'entityHandle',
    );
    this.values.assertEntityAllowed(entityHandle, policy);
    await this.permissionService.assertEntityPermission(
      user,
      entityHandle,
      'allowDelete',
    );
    const handle = this.values.requireHandleArg(args.handle, 'handle');

    await this.genericService.delete(entityHandle, handle, user);

    return {
      success: true,
      entityHandle,
      handle,
    };
  }
}
