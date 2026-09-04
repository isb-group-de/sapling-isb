import { AutomationReferenceResolverService } from './automation-reference-resolver.service';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

describe('AutomationReferenceResolverService', () => {
  const templates = {
    document: [
      {
        name: 'reference',
        genericReference: { entityField: 'entity', handleField: 'reference' },
      },
    ],
    ticket: [
      {
        name: 'timeTrackings',
        isReference: true,
        kind: '1:m',
        referenceName: 'ticketTimeTracking',
      },
    ],
    ticketTimeTracking: [
      {
        name: 'ticket',
        isReference: true,
        kind: 'm:1',
        referenceName: 'ticket',
      },
    ],
    person: [
      {
        name: 'tickets',
        isReference: true,
        kind: 'm:n',
        referenceName: 'ticket',
      },
    ],
  } as unknown as Record<string, EntityTemplateDto[]>;
  const service = new AutomationReferenceResolverService(
    {} as never,
    { getEntityTemplate: (entity: string) => templates[entity] ?? [] } as never,
  );

  it('validates mixed direct, inverse and generic-reference paths', () => {
    expect(() =>
      service.validate('document', 'ticket', [
        { field: 'reference', entity: 'ticket' },
      ]),
    ).not.toThrow();
    expect(() =>
      service.validate('ticketTimeTracking', 'ticket', [{ field: 'ticket' }]),
    ).not.toThrow();
    expect(() =>
      service.validate('ticket', 'ticketTimeTracking', [
        { direction: 'inverse', entity: 'ticketTimeTracking', field: 'ticket' },
      ]),
    ).not.toThrow();
    expect(() =>
      service.validate('person', 'ticket', [{ field: 'tickets' }]),
    ).not.toThrow();
  });

  it('rejects paths that do not reach their configured target', () => {
    expect(() =>
      service.validate('ticketTimeTracking', 'person', [{ field: 'ticket' }]),
    ).toThrow('automation.invalidReferencePath');
  });

  it('rejects collection and system fields as assignments', () => {
    expect(() =>
      service.validateConfiguration(
        'ticket',
        'ticket',
        [],
        [],
        [{ field: 'timeTrackings', value: [] }],
      ),
    ).toThrow('automation.invalidAssignmentField');
  });
});
