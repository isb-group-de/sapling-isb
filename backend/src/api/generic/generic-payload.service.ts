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

    this.assertRequiredPrimaryKeys(template, preparedPayload);
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
    }

    return nextData;
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
      GenericPayloadService.NULLABLE_NUMBER_TYPES.has(field.type)
    );
  }

  private assertRequiredPrimaryKeys(
    template: EntityTemplateDto[],
    data: Record<string, unknown>,
  ): void {
    const missingPrimaryKeys = template
      .filter(
        (field) =>
          field.isPrimaryKey === true &&
          field.isAutoIncrement !== true &&
          field.default == null &&
          field.defaultRaw == null,
      )
      .filter((field) => {
        const value = data[field.name];
        return (
          value === null ||
          value === undefined ||
          (typeof value === 'string' && value.trim().length === 0)
        );
      })
      .map((field) => field.name);

    if (missingPrimaryKeys.length === 0) {
      return;
    }

    throw new BadRequestException({
      message: 'global.requiredFieldsMissing',
      error: `Missing required primary key field(s): ${missingPrimaryKeys.join(', ')}`,
      details: {
        fields: missingPrimaryKeys,
      },
    });
  }
}
