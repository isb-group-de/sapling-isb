import { expect, it, jest } from '@jest/globals';
import {
  hasSaplingOption,
  ScriptResultServer,
  createTemplateField,
  toScriptItems,
  createGenericService,
} from './generic.service.spec-support';

describe('GenericService change-log resilience', () => {
  it('does not fail the update when change log persistence throws', async () => {
    (hasSaplingOption as jest.Mock).mockImplementation(() => false);

    const item = { handle: 7, phone: '+49 1111111111' };
    const findOne = jest
      .fn<() => Promise<object | null>>()
      .mockResolvedValueOnce({ handle: 'person' })
      .mockResolvedValueOnce(item);
    const assign = jest.fn((_item: object, data: object) => ({
      ...item,
      ...data,
    }));
    const flush = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const logEm = {
      create: jest.fn((cls: unknown, data: Record<string, unknown>) =>
        'action' in data ? { ...data, details: { add: jest.fn() } } : data,
      ),
      flush: jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('log failed')),
      getReference: jest.fn((_cls: unknown, handle: string | number) => ({
        handle,
      })),
    };
    const em = {
      findOne,
      assign,
      flush,
      create: logEm.create,
      fork: jest.fn(() => logEm),
    };
    const templateService = {
      getEntityTemplate: jest.fn(() => [
        createTemplateField({ name: 'handle', type: 'number' }),
        createTemplateField({ name: 'phone', type: 'string' }),
      ]),
    };
    const scriptService = {
      runServer: jest.fn((_method: unknown, items: object | object[]) =>
        Promise.resolve(new ScriptResultServer(toScriptItems(items))),
      ),
    };
    const currentService = {
      getEntityPermissions: jest.fn(() => ({ allowUpdateStage: 'global' })),
      getAllEntityPermissions: jest.fn(() => []),
    };
    const service = createGenericService({
      em,
      templateService,
      currentService,
      scriptService,
    });

    const result = await service.update(
      'person',
      7,
      { phone: '+49 1234567890' },
      { handle: 1 } as never,
      [],
    );

    expect(assign).toHaveBeenCalledWith(item, { phone: '+49 1234567890' });
    expect(result).toMatchObject({ handle: 7, phone: '+49 1234567890' });
  });
});
