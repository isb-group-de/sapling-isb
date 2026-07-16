import { ForbiddenException, Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { CurrentService } from '../current/current.service';
import { ImportService } from '../import/import.service';
import type {
  ConfigureImportBatchDto,
  ImportAiSuggestDto,
  ImportMatchRequestDto,
} from '../import/import.types';
import type { McpToolPolicy } from './mcp-policy.types';
import { SaplingMcpMetadataService } from './sapling-mcp-metadata.service';
import { SaplingMcpPermissionService } from './sapling-mcp-permission.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';
@Injectable()
export class SaplingMcpImportToolService {
  constructor(
    private readonly importService: ImportService,
    private readonly currentService: CurrentService,
    private readonly permissionService: SaplingMcpPermissionService,
    private readonly metadata: SaplingMcpMetadataService,
    private readonly values: SaplingMcpValueService,
  ) {}
  async executeImportGetBatch(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    await this.assertImportAdministrator(user);
    const batchHandle = this.values.requirePositiveIntArg(
      args.batchHandle,
      'batchHandle',
    );
    const batch = await this.importService.getBatch(batchHandle);

    if (batch.entityHandle) {
      this.values.assertEntityAllowed(batch.entityHandle, policy);
    }

    return batch;
  }

  async executeImportListTemplates(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    await this.assertImportAdministrator(user);
    const entityHandle = this.values.asStringValue(args.entityHandle);

    if (entityHandle) {
      this.values.assertEntityAllowed(entityHandle, policy);
      await this.permissionService.assertEntityPermission(
        user,
        entityHandle,
        'allowRead',
      );
    }

    return this.importService.listTemplates(
      entityHandle ?? undefined,
      this.values.asStringValue(args.sourceHandle) ?? undefined,
    );
  }

  async executeImportSuggestMapping(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    await this.assertImportAdministrator(user);
    const batchHandle = this.values.requirePositiveIntArg(
      args.batchHandle,
      'batchHandle',
    );
    const batch = await this.importService.getBatch(batchHandle);
    const entityHandle =
      this.values.asStringValue(args.entityHandle) ?? batch.entityHandle;

    if (entityHandle) {
      this.values.assertEntityAllowed(entityHandle, policy);
      await this.permissionService.assertEntityPermission(
        user,
        entityHandle,
        'allowRead',
      );
    }

    const dto: ImportAiSuggestDto = {
      entityHandle,
      sourceHandle: this.values.asStringValue(args.sourceHandle),
      maxSampleRows: this.values.asPositiveNumber(args.maxSampleRows),
    };

    return this.importService.suggestBatchConfiguration(batchHandle, dto, user);
  }

  async executeImportConfigureBatch(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    await this.assertImportAdministrator(user);
    const batchHandle = this.values.requirePositiveIntArg(
      args.batchHandle,
      'batchHandle',
    );
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
    const sourceHandle = this.values.asStringValue(args.sourceHandle);
    const batch = await this.importService.getBatch(batchHandle);

    const dto: ConfigureImportBatchDto = {
      entityHandle,
      sourceHandle,
      templateHandle: this.values.asPositiveNumber(args.templateHandle),
      keyColumns: sourceHandle
        ? this.values.asStringArray(args.keyColumns)
        : [],
      mappings: this.values.withImplicitHandleMapping(
        this.values.asFieldMappingArray(args.mappings),
        batch.headers,
      ) as ConfigureImportBatchDto['mappings'],
      relationMappings: this.values.asRecordArray(
        args.relationMappings,
      ) as ConfigureImportBatchDto['relationMappings'],
      valueMappings: this.values.asRecordArray(
        args.valueMappings,
      ) as ConfigureImportBatchDto['valueMappings'],
      genericReferenceMapping:
        Object.keys(this.values.asRecord(args.genericReferenceMapping)).length >
        0
          ? (this.values.asRecord(
              args.genericReferenceMapping,
            ) as ConfigureImportBatchDto['genericReferenceMapping'])
          : null,
    };

    return this.importService.configureBatch(batchHandle, dto, user);
  }

  async executeImportExecuteBatch(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    await this.assertImportAdministrator(user);
    const batchHandle = this.values.requirePositiveIntArg(
      args.batchHandle,
      'batchHandle',
    );
    const batch = await this.importService.getBatch(batchHandle);

    if (batch.entityHandle) {
      this.values.assertEntityAllowed(batch.entityHandle, policy);
      await this.permissionService.assertEntityPermission(
        user,
        batch.entityHandle,
        'allowInsert',
      );
    }

    return this.importService.executeBatch(batchHandle, user);
  }

  async executeImportMatchExistingRecords(
    args: Record<string, unknown>,
    user: PersonItem,
    policy?: McpToolPolicy,
  ): Promise<unknown> {
    await this.assertImportAdministrator(user);
    const batchHandle = this.values.requirePositiveIntArg(
      args.batchHandle,
      'batchHandle',
    );
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

    const batch = await this.importService.getBatch(batchHandle);
    const sourceColumns = this.resolveImportMatchSourceColumns(
      batch,
      this.values.asStringArray(args.sourceColumns),
    );
    const targetFields = this.resolveImportMatchTargetFields(
      entityHandle,
      this.values.asStringArray(args.targetFields),
    );

    if (targetFields.length === 0) {
      throw new ForbiddenException('ai.importNoSearchableFields');
    }

    const matchRequest: ImportMatchRequestDto = {
      entityHandle,
      sourceColumns,
      targetFields,
      sampleLimit: this.values.asPositiveNumber(args.sampleLimit) ?? 10,
      limitPerValue: this.values.asPositiveNumber(args.limitPerValue) ?? 3,
    };

    return this.importService.matchBatchExistingRecords(
      batchHandle,
      matchRequest,
      user,
    );
  }

  private async assertImportAdministrator(user: PersonItem): Promise<void> {
    const person = await this.currentService.getPerson(user);
    const rolesSource = person?.roles as
      | Array<{ isAdministrator?: boolean }>
      | { getItems?: () => Array<{ isAdministrator?: boolean }> }
      | undefined;
    const roles = Array.isArray(rolesSource)
      ? rolesSource
      : (rolesSource?.getItems?.() ?? []);

    if (!roles.some((role) => role.isAdministrator === true)) {
      throw new ForbiddenException('global.permissionDenied');
    }
  }

  private resolveImportMatchSourceColumns(
    batch: { headers: string[]; mapping?: object | null },
    requestedColumns: string[],
  ): string[] {
    const headerSet = new Set(batch.headers);
    const requested = requestedColumns.filter((column) =>
      headerSet.has(column),
    );

    if (requested.length > 0) {
      return requested;
    }

    const mapping = this.values.asRecord(batch.mapping);
    const mappedColumns = Array.isArray(mapping.mappings)
      ? mapping.mappings
          .map((entry) =>
            this.values.asStringValue(this.values.asRecord(entry).sourceColumn),
          )
          .filter(
            (column): column is string => !!column && headerSet.has(column),
          )
      : [];

    return mappedColumns.length > 0
      ? [...new Set(mappedColumns)]
      : batch.headers;
  }

  private resolveImportMatchTargetFields(
    entityHandle: string,
    requestedFields: string[],
  ): string[] {
    const fields = this.metadata
      .getEntityTemplate(entityHandle)
      .filter(
        (field) =>
          !field.isReference &&
          !field.isPrimaryKey &&
          field.type === 'string' &&
          !field.options?.includes('isSecurity'),
      );
    const fieldNames = new Set(fields.map((field) => field.name));
    const requested = requestedFields.filter((field) => fieldNames.has(field));

    if (requested.length > 0) {
      return requested;
    }

    const preferredFields = [
      'number',
      'externalNumber',
      'title',
      'name',
      'firstName',
      'lastName',
      'email',
      'subject',
      'description',
    ].filter((field) => fieldNames.has(field));

    if (preferredFields.length > 0) {
      return preferredFields;
    }

    return fields
      .filter((field) => field.options?.includes('isValue'))
      .map((field) => field.name)
      .slice(0, 5);
  }
}
