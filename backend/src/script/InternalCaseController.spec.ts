import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../entity/EntityItem', () => ({ EntityItem: class {} }));
jest.mock('../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../entity/InternalCaseItem', () => ({ InternalCaseItem: class {} }));

import { InternalCaseController } from './InternalCaseController';
import type { InternalCaseItem } from '../entity/InternalCaseItem';
import { ScriptResultServerMethods } from './core/script.result.server';

describe('InternalCaseController', () => {
  it('assigns a distinct year-based internal case number after insert', async () => {
    const items = [
      {
        handle: 42,
        createdAt: new Date('2026-07-07T10:15:00.000Z'),
      },
    ] as InternalCaseItem[];
    const controller = new InternalCaseController(
      { handle: 'internalCase' } as never,
      { handle: 99 } as never,
      {} as never,
    );

    const result = await controller.afterInsert(items);

    expect(items[0].number).toBe('IC-2026-00042');
    expect(result.items).toBe(items);
    expect(result.method).toBe(ScriptResultServerMethods.overwrite);
  });
});
