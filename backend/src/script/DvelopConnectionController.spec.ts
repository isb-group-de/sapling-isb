import { describe, expect, it } from '@jest/globals';
import { DvelopConnectionController } from './DvelopConnectionController';
import { DvelopConnectionItem } from '../entity/DvelopConnectionItem';
import { EntityItem } from '../entity/EntityItem';
import { PersonItem } from '../entity/PersonItem';
import { ScriptResultServerMethods } from './core/script.result.server';

describe('DvelopConnectionController', () => {
  it('keeps existing API keys when the security field is submitted empty', async () => {
    const controller = new DvelopConnectionController(
      { handle: 'dvelopConnection' } as EntityItem,
      { handle: 1 } as PersonItem,
    );
    const items = [
      { handle: 1, title: 'Connection', apiKey: '' },
      { handle: 2, title: 'Connection with key', apiKey: 'secret' },
    ] as DvelopConnectionItem[];

    const result = await controller.beforeUpdate(items);

    expect(result.method).toBe(ScriptResultServerMethods.overwrite);
    expect('apiKey' in items[0]).toBe(false);
    expect(items[1].apiKey).toBe('secret');
  });
});
