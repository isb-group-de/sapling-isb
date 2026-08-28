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
      } as EntityTemplateDto,
    ];

    expect(service.reduceReferenceFields(template, payload)).toEqual({
      company: 42,
    });
  });

  it('removes inverse one-to-one references from mutation payloads', () => {
    const payload = {
      title: 'Copied event',
      azure: { handle: 17, referenceHandle: 'outlook-event-id' },
    };
    const template = [
      {
        name: 'azure',
        isReference: true,
        kind: '1:1',
        mappedBy: 'event',
      } as EntityTemplateDto,
    ];

    expect(service.reduceReferenceFields(template, payload)).toEqual({
      title: 'Copied event',
    });
  });

  it.each(['m:n', 'n:m'] as const)(
    'preserves handle arrays for a %s collection reference',
    (kind) => {
      const payload = { participants: [5, 7] };
      const template = [
        {
          name: 'participants',
          isReference: true,
          kind,
        } as EntityTemplateDto,
      ];

      expect(service.reduceReferenceFields(template, payload)).toEqual({
        participants: [5, 7],
      });
    },
  );
});
