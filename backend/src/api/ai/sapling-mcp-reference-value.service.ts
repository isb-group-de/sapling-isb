import { BadRequestException, Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { CurrentService } from '../current/current.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { SaplingMcpMetadataService } from './sapling-mcp-metadata.service';
import { SaplingMcpValueService } from './sapling-mcp-value.service';

@Injectable()
export class SaplingMcpReferenceValueService {
  constructor(
    private readonly currentService: CurrentService,
    private readonly metadata: SaplingMcpMetadataService,
    private readonly values: SaplingMcpValueService,
  ) {}

  async applyCurrentDefaults(
    entityHandle: string,
    data: Record<string, unknown>,
    user: PersonItem,
  ): Promise<Record<string, unknown>> {
    const fields = this.metadata
      .getEntityTemplate(entityHandle)
      .filter(
        (field) =>
          field.isReference &&
          (field.options?.includes('isCurrentCompany') ||
            field.options?.includes('isCurrentPerson')),
      );
    if (fields.length === 0) return data;

    const defaultedData = { ...data };
    let currentPersonRecord: Record<string, unknown> | null | undefined;
    for (const field of fields) {
      if (this.hasReferencePayloadValue(field, defaultedData[field.name]))
        continue;

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
    return defaultedData;
  }

  normalizeMutationReferences(
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
      if (!Object.prototype.hasOwnProperty.call(normalizedData, field.name))
        continue;
      const value = normalizedData[field.name];
      if (value == null) continue;

      const submittedValue =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>).handle
          : value;
      normalizedData[field.name] = this.normalizeReferenceHandleValue(
        entityHandle,
        field,
        submittedValue,
        this.metadata.getEntityTemplate(field.referenceName),
      );
    }
    return normalizedData;
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
    if (this.values.asResultHandle(value) != null) return true;
    if (Array.isArray(value) || !value || typeof value !== 'object')
      return false;
    return (
      this.values.asResultHandle((value as Record<string, unknown>).handle) !=
      null
    );
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
      if (Number.isFinite(numericValue)) return numericValue;
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
}
