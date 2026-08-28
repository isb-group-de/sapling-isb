import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericReferenceService } from './generic-reference.service';

@Injectable()
export class GenericPayloadService {
  private static readonly NULLABLE_NUMBER_TYPES = new Set([
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

  constructor(
    private readonly genericReferenceService: GenericReferenceService,
  ) {}

  sanitizeClientMutationPayload(
    data: Record<string, any>,
  ): Record<string, any> {
    const sanitizedPayload = { ...data };

    delete sanitizedPayload.createdAt;
    delete sanitizedPayload.updatedAt;

    if (sanitizedPayload.handle === null) {
      delete sanitizedPayload.handle;
    }

    return sanitizedPayload;
  }

  prepareCreatePayload(
    template: EntityTemplateDto[] = [],
    data: Record<string, any>,
  ): Record<string, any> {
    const preparedPayload = this.preparePayload(template, data, {
      removeAutoIncrement: true,
    });

    this.assertRequiredHandle(template, preparedPayload);
    return preparedPayload;
  }

  prepareUpdatePayload(
    template: EntityTemplateDto[] = [],
    data: Record<string, any>,
  ): Record<string, any> {
    return this.preparePayload(template, data, {
      removeAutoIncrement: false,
    });
  }

  buildDependencyValidationPayload(
    item: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...item,
      ...data,
    };
  }

  private preparePayload(
    template: EntityTemplateDto[],
    data: Record<string, any>,
    options: { removeAutoIncrement: boolean },
  ): Record<string, any> {
    if (!template.length) {
      return data;
    }

    const nextData = this.genericReferenceService.reduceReferenceFields(
      template,
      data,
    ) as Record<string, any>;

    for (const field of template) {
      const isReadOnly = field.options?.includes('isReadOnly');
      const shouldRemove =
        isReadOnly || (options.removeAutoIncrement && field.isAutoIncrement);

      if (shouldRemove && typeof field.name !== 'undefined') {
        delete nextData[field.name];
        continue;
      }

      if (
        typeof field.name !== 'undefined' &&
        this.shouldNormalizeEmptyStringToNull(field, nextData[field.name])
      ) {
        nextData[field.name] = null;
      }

      this.assertMaximumLength(field, nextData[field.name]);
    }

    return nextData;
  }

  private assertMaximumLength(field: EntityTemplateDto, value: unknown): void {
    if (
      typeof value !== 'string' ||
      typeof field.length !== 'number' ||
      field.length <= 0 ||
      value.length <= field.length
    ) {
      return;
    }

    throw new BadRequestException({
      message: 'global.maximumLengthExceeded',
      error: 'Maximum field length exceeded.',
      details: {
        field: field.name,
        maxLength: field.length,
      },
    });
  }

  private shouldNormalizeEmptyStringToNull(
    field: EntityTemplateDto,
    value: unknown,
  ): boolean {
    return (
      typeof value === 'string' &&
      value.trim().length === 0 &&
      field.nullable === true &&
      field.isReference !== true &&
      (field.isUnique === true ||
        GenericPayloadService.NULLABLE_NUMBER_TYPES.has(field.type))
    );
  }

  private assertRequiredHandle(
    template: EntityTemplateDto[],
    data: Record<string, unknown>,
  ): void {
    const handleField = template.find((field) => field.name === 'handle');
    if (
      !handleField ||
      handleField.isAutoIncrement === true ||
      handleField.default != null ||
      handleField.defaultRaw != null
    ) {
      return;
    }

    const handle = data.handle;
    if (
      handle !== null &&
      handle !== undefined &&
      (typeof handle !== 'string' || handle.trim().length > 0)
    ) {
      return;
    }

    throw new BadRequestException({
      message: 'global.requiredFieldsMissing',
      error: 'Missing required handle field.',
      details: {
        fields: ['handle'],
      },
    });
  }
}
