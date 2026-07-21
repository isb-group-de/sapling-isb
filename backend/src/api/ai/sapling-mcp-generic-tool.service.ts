import { BadRequestException, Injectable } from '@nestjs/common';
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
    const limit = this.values.asPositiveNumber(args.limit) ?? 50;

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
    const referencedPks =
      field.referencedPks.length > 0 ? field.referencedPks : ['handle'];

    return referencedPks.every(
      (referencedPk) =>
        this.values.asResultHandle(record[referencedPk]) != null,
    );
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
      const referencedPks =
        field.referencedPks.length > 0
          ? field.referencedPks
          : referenceTemplate
              .filter((referenceField) => referenceField.isPrimaryKey)
              .map((referenceField) => referenceField.name);
      const effectivePks =
        referencedPks.length > 0 ? referencedPks : ['handle'];

      if (effectivePks.length !== 1) {
        this.assertCompositeReferenceValue(
          entityHandle,
          field,
          value,
          effectivePks,
          referenceTemplate,
        );
        continue;
      }

      const referencedPk = effectivePks[0];
      const submittedValue =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)[referencedPk]
          : value;
      normalizedData[field.name] = this.normalizeReferencePrimaryKeyValue(
        entityHandle,
        field,
        referencedPk,
        submittedValue,
        referenceTemplate,
      );
    }

    return normalizedData;
  }

  private assertCompositeReferenceValue(
    entityHandle: string,
    field: EntityTemplateDto,
    value: unknown,
    referencedPks: string[],
    referenceTemplate: EntityTemplateDto[],
  ): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      this.throwReferencePrimaryKeyRequired(
        entityHandle,
        field,
        referencedPks.join(', '),
      );
    }

    const record = value as Record<string, unknown>;
    for (const referencedPk of referencedPks) {
      this.normalizeReferencePrimaryKeyValue(
        entityHandle,
        field,
        referencedPk,
        record[referencedPk],
        referenceTemplate,
      );
    }
  }

  private normalizeReferencePrimaryKeyValue(
    entityHandle: string,
    field: EntityTemplateDto,
    referencedPk: string,
    value: unknown,
    referenceTemplate: EntityTemplateDto[],
  ): string | number {
    const primaryKeyType = referenceTemplate.find(
      (referenceField) => referenceField.name === referencedPk,
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

    if (numericTypes.has(String(primaryKeyType).toLowerCase())) {
      const numericValue =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim()
            ? Number(value)
            : Number.NaN;
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
      this.throwReferencePrimaryKeyRequired(entityHandle, field, referencedPk);
    }

    if (
      (typeof value === 'string' && value.trim()) ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return typeof value === 'string' ? value.trim() : value;
    }

    this.throwReferencePrimaryKeyRequired(entityHandle, field, referencedPk);
  }

  private throwReferencePrimaryKeyRequired(
    entityHandle: string,
    field: EntityTemplateDto,
    referencedPk: string,
  ): never {
    throw new BadRequestException(
      `Reference field "${field.name}" on "${entityHandle}" requires the ${field.referenceName}.${referencedPk} primary-key value. Do not send a display label; look up the referenced record with generic_list first.`,
    );
  }

  async executeGenericCreate(
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
