import { validateReferenceContext } from './generic-reference-context';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

const link = (
  name: string,
  referenceName: string,
  sourceField: string,
  targetField = sourceField,
) =>
  ({
    name,
    referenceName,
    isReference: true,
    referenceTemplate: {
      mappings: [
        { sourceField, targetField, overwrite: false, validate: true },
      ],
    },
  }) as EntityTemplateDto;

describe('business reference context', () => {
  const templates = [
    link('ticket', 'ticket', 'salesOpportunity'),
    link('effortEstimate', 'effortEstimate', 'salesOpportunity'),
  ];
  const records: Record<string, Record<string, unknown>> = {
    'ticket:1': { handle: 1, salesOpportunity: 10 },
    'ticket:2': { handle: 2, salesOpportunity: 20 },
    'effortEstimate:3': { handle: 3, ticket: 1 },
    'effortEstimate:4': { handle: 4, ticket: 2 },
  };
  const check = (data: Record<string, unknown>) =>
    validateReferenceContext({
      entityHandle: 'event',
      data,
      templates,
      getTemplates: (entity) =>
        entity === 'effortEstimate'
          ? [link('ticket', 'ticket', 'salesOpportunity')]
          : [],
      load: async (entity, handle) => records[`${entity}:${handle}`] ?? null,
    });

  it('allows matching direct and indirect links without duplicating context', async () => {
    const data = { ticket: 1, effortEstimate: 3 };
    await expect(check(data)).resolves.toBeUndefined();
    expect(data).toEqual({ ticket: 1, effortEstimate: 3 });
  });
  it('rejects a contradictory explicit opportunity through an estimate and ticket', async () => {
    await expect(
      check({ effortEstimate: 3, salesOpportunity: 20 }),
    ).rejects.toThrow();
  });
  it('rejects conflicting linked records even when the local opportunity is empty', async () => {
    await expect(check({ ticket: 1, effortEstimate: 4 })).rejects.toThrow();
  });
  it('allows standalone records and explicit empty references', async () => {
    await expect(
      check({ ticket: null, salesOpportunity: 10 }),
    ).resolves.toBeUndefined();
  });
  it('does not use a missing or inaccessible source', async () => {
    await expect(check({ ticket: 999 })).rejects.toThrow(
      'global.referenceNotFound',
    );
  });
});
