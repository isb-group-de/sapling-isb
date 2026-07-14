import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../entity/EntityItem', () => ({ EntityItem: class {} }));
jest.mock('../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../entity/SalesOpportunityItem', () => ({
  SalesOpportunityItem: class {},
}));

import type { SalesOpportunityItem } from '../entity/SalesOpportunityItem';
import { SalesOpportunityController } from './SalesOpportunityController';
import { ScriptResultServerMethods } from './core/script.result.server';

describe('SalesOpportunityController', () => {
  it('assigns an independent prefixed opportunity number after insert', async () => {
    const items = [
      {
        handle: 42,
        createdAt: new Date('2026-07-14T08:00:00.000Z'),
      },
    ] as SalesOpportunityItem[];
    const controller = new SalesOpportunityController(
      { handle: 'salesOpportunity' } as never,
      { handle: 99 } as never,
      {} as never,
    );

    const result = await controller.afterInsert(items);

    expect(items[0].number).toBe('SO-2026-00042');
    expect(result.items).toBe(items);
    expect(result.method).toBe(ScriptResultServerMethods.overwrite);
  });

  it('uses the opportunity number in the AI reference prompt', async () => {
    const controller = new SalesOpportunityController(
      { handle: 'salesOpportunity' } as never,
      { handle: 99 } as never,
      {} as never,
    );

    const result = await controller.execute(
      [{ handle: 42, number: 'SO-2026-00042', title: 'Cloud migration' }],
      'aiFindOpportunityReferences',
    );
    const prompt = new URL(result.parameter).searchParams.get('prompt');

    expect(prompt).toContain('Aktuelle Verkaufschance: SO-2026-00042');
  });
});
