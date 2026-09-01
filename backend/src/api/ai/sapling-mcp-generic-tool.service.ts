import { BadRequestException, Injectable } from '@nestjs/common';
import { GENERIC_LIST_MAX_LIMIT } from '../../constants/project.constants';
import { PersonItem } from '../../entity/PersonItem';
import { CurrentService } from '../current/current.service';
import { GenericService } from '../generic/generic.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { McpToolPolicy } from './mcp-policy.types';
import { SAPLING_MCP_USAGE_HINTS } from './prompts/sapling-mcp.prompts';
import { SaplingMcpCriteriaRepairRequest } from './sapling-mcp-criteria.types';
import { SaplingMcpCriteriaService } from './sapling-mcp-criteria.service';
import { SaplingMcpMetadataService } from './sapling-mcp-metadata.service';
import { SaplingMcpPermissionService } from './sapling-mcp-permission.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
@Injectable()
export class SaplingMcpGenericToolService {
  constructor(
    private readonly genericService: GenericService,
    private readonly currentService: CurrentService,
    private readonly criteriaService: SaplingMcpCriteriaService,
    private readonly permissionService: SaplingMcpPermissionService,
    private readonly metadata: SaplingMcpMetadataService,
    private readonly values: SaplingMcpValueService,
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

  private async applyCurrentReferenceDefaults(
    entityHandle: string,
    data: Record<string, unknown>,
    user: PersonItem,
  ): Promise<Record<string, unknown>> {
    const template = this.metadata.getEntityTemplate(entityHandle);
    const fields = template.filter(
      (field) =>
        field.isReference &&
        (field.options?.includes('isCurrentCompany') ||
          field.options?.includes('isCurrentPerson')),
    );

    if (fields.length === 0) {
      return data;
    }

    const defaultedData = { ...data };
    let currentPersonRecord: Record<string, unknown> | null | undefined;

    for (const field of fields) {
      if (this.hasReferencePayloadValue(field, defaultedData[field.name])) {
        continue;
      }

      if (field.options?.includes('isCurrentPerson')) {
        const currentPersonHandle =
          this.values.asResultHandle(user.handle) ??
          this.values.asResultHandle(
            (currentPersonRecord ??=
              await this.resolveCurrentPersonRecord(user)).handle,
          );

        if (currentPersonHandle == null) {
          throw new BadRequestException('ai.mcpCurrentPersonMissing');
        }

        defaultedData[field.name] = currentPersonHandle;
        continue;
      }

      if (field.options?.includes('isCurrentCompany')) {
        currentPersonRecord ??= await this.resolveCurrentPersonRecord(user);
        const companyHandle =
          this.values.asResultHandle(currentPersonRecord?.company) ??
          this.values.asResultHandle(
            this.values.asEntityRecord(currentPersonRecord?.company)?.handle,
          );

        if (companyHandle == null) {
          throw new BadRequestException('ai.mcpCurrentCompanyMissing');
        }

        defaultedData[field.name] = companyHandle;
      }
    }

    return defaultedData;
  }

  private async resolveCurrentPersonRecord(
    user: PersonItem,
  ): Promise<Record<string, unknown>> {
    const currentPerson = (await this.currentService.getPerson(user)) ?? user;
    return this.values.asEntityRecord(currentPerson) ?? {};
  }

  private hasReferencePayloadValue(
    field: EntityTemplateDto,
    value: unknown,
  ): boolean {
    if (this.values.asResultHandle(value) != null) {
      return true;
    }

    if (Array.isArray(value) || !value || typeof value !== 'object') {
      return false;
    }

    const record = value as Record<string, unknown>;
    return this.values.asResultHandle(record.handle) != null;
  }

  private normalizeMutationReferences(
    entityHandle: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalizedData = { ...data };
    const referenceFields = this.metadata
      .getEntityTemplate(entityHandle)
      .filter(
        (field) =>
          field.isReference &&
          !!field.referenceName &&
          (field.kind === 'm:1' || field.kind === '1:1'),
      );

    for (const field of referenceFields) {
      if (!Object.prototype.hasOwnProperty.call(normalizedData, field.name)) {
        continue;
      }

      const value = normalizedData[field.name];
      if (value == null) {
        continue;
      }

      const referenceTemplate = this.metadata.getEntityTemplate(
        field.referenceName,
      );
      const submittedValue =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>).handle
          : value;
      normalizedData[field.name] = this.normalizeReferenceHandleValue(
        entityHandle,
        field,
        submittedValue,
        referenceTemplate,
      );
    }

    return normalizedData;
  }

  private normalizeReferenceHandleValue(
    entityHandle: string,
    field: EntityTemplateDto,
    value: unknown,
    referenceTemplate: EntityTemplateDto[],
  ): string | number {
    const handleType = referenceTemplate.find(
      (referenceField) => referenceField.name === 'handle',
    )?.type;
    const numericTypes = new Set([
      'number',
      'float',
      'double',
      'decimal',
      'real',
      'int',
      'integer',
      'smallint',
      'bigint',
    ]);

    if (numericTypes.has(String(handleType).toLowerCase())) {
      const numericValue =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim()
            ? Number(value)
            : Number.NaN;
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
      this.throwReferenceHandleRequired(entityHandle, field);
    }

    if (
      (typeof value === 'string' && value.trim()) ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return typeof value === 'string' ? value.trim() : value;
    }

    this.throwReferenceHandleRequired(entityHandle, field);
  }

  private throwReferenceHandleRequired(
    entityHandle: string,
    field: EntityTemplateDto,
  ): never {
    throw new BadRequestException(
      `Reference field "${field.name}" on "${entityHandle}" requires the ${field.referenceName}.handle value. Do not send a display label; look up the referenced record with generic_list first.`,
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
    const defaultedData = await this.applyCurrentReferenceDefaults(
      entityHandle,
      data,
      user,
    );
    const normalizedData = this.normalizeMutationReferences(
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
    const normalizedData = this.normalizeMutationReferences(entityHandle, data);
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
        ? await this.applyCurrentReferenceDefaults(
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
        const submittedValue =
          value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>).handle
            : value;

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
            },
            user,
            policy,
          )) as { found?: unknown };

          if (referencedRecord.found !== true) {
            invalidReferences.push({
              fieldName,
              referenceName: field.referenceName,
              handleField: 'handle',
              submittedValue,
              reason: 'referenceRecordNotFound',
            });
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
