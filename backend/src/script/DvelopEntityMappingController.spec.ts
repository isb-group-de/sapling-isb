import { describe, expect, it } from '@jest/globals';
import { DvelopEntityMappingController } from './DvelopEntityMappingController';
import { EntityItem } from '../entity/EntityItem';
import { PersonItem } from '../entity/PersonItem';
import { ScriptResultClientMethods } from './core/script.result.client';

describe('DvelopEntityMappingController', () => {
  it('opens Songbird with a property-mapping prompt', async () => {
    const controller = new DvelopEntityMappingController(
      { handle: 'dvelopEntityMapping' } as EntityItem,
      { handle: 1 } as PersonItem,
    );

    const result = await controller.execute(
      [
        {
          handle: 7,
          entity: { handle: 'ticket', title: 'Ticket' },
          connection: { handle: 3, title: 'Testsystem' },
          objectDefinition: { handle: 5, title: 'Supportakte' },
        },
      ],
      'aiCreatePropertyMappings',
    );

    expect(result.method).toBe(ScriptResultClientMethods.callURL);
    expect(result.parameter).toContain('sapling-ai-chat://prompt?');

    const url = new URL(result.parameter);
    const prompt = url.searchParams.get('prompt') ?? '';

    expect(url.searchParams.get('agentHandle')).toBe('songbirdGeneral');
    expect(url.searchParams.get('contextEntityHandle')).toBe(
      'dvelopEntityMapping',
    );
    expect(url.searchParams.get('contextRecordHandle')).toBe('7');
    expect(prompt).toContain('entityHandle: dvelopEntityMapping');
    expect(prompt).toContain('entity_schema');
    expect(prompt).toContain('dvelopEntityMappingProperty');
    expect(prompt).toContain('generic_create');
    expect(prompt).toContain('generic_update');
  });
});
