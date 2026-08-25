import { describe, expect, it } from '@jest/globals';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { ImportFieldValidationService } from './import-field-validation.service';

function field(
  name: string,
  overrides: Partial<EntityTemplateDto> = {},
): EntityTemplateDto {
  return {
    name,
    type: 'string',
    isAutoIncrement: false,
    isUnique: false,
    referenceName: '',
    isReference: false,
    isRequired: false,
    nullable: true,
    isPersistent: true,
    options: [],
    formGroup: null,
    formGroupOrder: null,
    formOrder: null,
    formWidth: null,
    ...overrides,
  };
}

describe('ImportFieldValidationService', () => {
  const service = new ImportFieldValidationService();

  it('applies configured reference and current-person defaults', () => {
    const payload: Record<string, unknown> = {};
    const template = [
      field('status', {
        isReference: true,
        referenceName: 'ticketStatus',
        kind: 'm:1',
      }),
      field('responsible', {
        isReference: true,
        referenceName: 'person',
        kind: 'm:1',
        options: ['isCurrentPerson'],
      }),
    ];

    service.applyDefaults(
      template,
      payload,
      [{ targetField: 'status', value: { handle: 3 } }],
      { handle: 9 } as never,
    );

    expect(payload).toEqual({ status: 3, responsible: 9 });
  });

  it('rejects invalid date and boolean values with field-specific messages', () => {
    expect(() =>
      service.validatePrimitiveValues(
        [field('startsAt', { type: 'datetime' })],
        { startsAt: 'NULL' },
      ),
    ).toThrow('import.invalidDateValues:startsAt');

    expect(() =>
      service.validatePrimitiveValues(
        [field('isActive', { type: 'boolean' })],
        { isActive: -1 },
      ),
    ).toThrow('import.invalidBooleanValues:isActive');
  });

  it('finds required fields only for creates and normalizes the error message', () => {
    const template = [
      field('title', { isRequired: true }),
      field('customFields.code', { isRequired: true, customField: {} }),
    ];

    expect(
      service.getMissingRequiredFieldNames(template, {}, 'created'),
    ).toEqual(['title']);
    expect(
      service.getMissingRequiredFieldNames(template, {}, 'updated'),
    ).toEqual([]);
    expect(
      service.createRequiredFieldsMissingMessage([' title ', 'title']),
    ).toBe('import.requiredFieldsMissing:title');
  });
});
