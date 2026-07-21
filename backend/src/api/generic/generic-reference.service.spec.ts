import { GenericReferenceService } from './generic-reference.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';

describe('GenericReferenceService', () => {
  const service = new GenericReferenceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it.each(['m:1', '1:1'] as const)(
    'preserves explicit null for an owning %s reference',
    (kind) => {
      const payload = { company: null };
      const template = [
        {
          name: 'company',
          isReference: true,
          kind,
          referencedPks: ['handle'],
        } as EntityTemplateDto,
      ];

      expect(service.reduceReferenceFields(template, payload)).toEqual({
        company: null,
      });
    },
  );

  it('still reduces an owning reference object to its primary key', () => {
    const payload = { company: { handle: 42, name: 'Sapling' } };
    const template = [
      {
        name: 'company',
        isReference: true,
        kind: 'm:1',
        referencedPks: ['handle'],
      } as EntityTemplateDto,
    ];

    expect(service.reduceReferenceFields(template, payload)).toEqual({
      company: 42,
    });
  });
});
