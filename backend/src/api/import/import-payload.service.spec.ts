import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { ImportFieldValidationService } from './import-field-validation.service';
import { ImportPayloadService } from './import-payload.service';

describe('ImportPayloadService', () => {
  function createService() {
    const referenceResolver = {
      applyRelationMappings: jest.fn(() => Promise.resolve()),
      applyGenericReferenceMapping: jest.fn(() => Promise.resolve()),
      resolveValueReference: jest.fn(),
    };
    const genericCustomFieldService = {
      collectCustomFieldsFromFlatPayload: jest.fn(),
    };
    const service = new ImportPayloadService(
      referenceResolver as never,
      new ImportFieldValidationService(),
      genericCustomFieldService as never,
    );
    return { service, referenceResolver, genericCustomFieldService };
  }

  it('includes target field and source value in missing value-mapping errors', async () => {
    const { service } = createService();

    await expect(
      service.applyValueMapping([], 'status', 'Fremdwert A', [
        {
          targetField: 'status',
          fallback: 'error',
          values: {},
        },
      ]),
    ).rejects.toThrow('import.valueMappingMissing:status:Fremdwert%20A');
  });

  it('reports unresolved kept reference values as missing mappings', async () => {
    const { service, referenceResolver } = createService();
    referenceResolver.resolveValueReference.mockRejectedValue(
      new Error('not found'),
    );

    await expect(
      service.applyValueMapping(
        [
          {
            name: 'status',
            isReference: true,
            referenceName: 'ticketStatus',
            kind: 'm:1',
          } as EntityTemplateDto,
        ],
        'status',
        'Unbekannt',
        [{ targetField: 'status', fallback: 'keep', values: {} }],
      ),
    ).rejects.toThrow('import.valueMappingMissing:status:Unbekannt');
  });

  it('applies reference defaults after source mapping and normalizes the payload', async () => {
    const { service, referenceResolver, genericCustomFieldService } =
      createService();
    const template = [
      {
        name: 'country',
        type: 'CountryItem',
        isReference: true,
        referenceName: 'country',
        kind: 'm:1',
        isRequired: true,
      } as EntityTemplateDto,
    ];

    const payload = await service.buildPayload(
      template,
      { Land: '' },
      {
        entityHandle: 'company',
        mappings: [{ sourceColumn: 'Land', targetField: 'country' }],
        fieldDefaults: [
          {
            targetField: 'country',
            value: { handle: 'DE', name: 'Deutschland' },
          },
        ],
      },
      { handle: 7 } as never,
    );

    expect(payload.country).toBe('DE');
    expect(referenceResolver.applyRelationMappings).toHaveBeenCalled();
    expect(referenceResolver.applyGenericReferenceMapping).toHaveBeenCalled();
    expect(
      genericCustomFieldService.collectCustomFieldsFromFlatPayload,
    ).toHaveBeenCalledWith(payload);
  });

  it('truncates ticket titles at the database-backed maximum', async () => {
    const { service } = createService();
    const payload = await service.buildPayload(
      [
        {
          name: 'title',
          type: 'string',
          length: 256,
          isPersistent: true,
          options: [],
        } as unknown as EntityTemplateDto,
      ],
      { Betreff: 'x'.repeat(300) },
      {
        entityHandle: 'ticket',
        mappings: [{ sourceColumn: 'Betreff', targetField: 'title' }],
      },
      { handle: 7 } as never,
    );

    expect(payload.title).toHaveLength(256);
  });
});
