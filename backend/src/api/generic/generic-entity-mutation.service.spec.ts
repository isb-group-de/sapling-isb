import { describe, expect, it, jest } from '@jest/globals';
import { GenericEntityMutationService } from './generic-entity-mutation.service';
import { GenericPayloadService } from './generic-payload.service';

const timestampedPayload = {
  handle: null,
  title: 'Changed',
  createdAt: '2026-07-20T09:17:59.247Z',
  updatedAt: '2026-07-23T10:01:16.189Z',
};

function createSubject() {
  const template = [
    {
      name: 'handle',
      type: 'number',
      isAutoIncrement: true,
    },
    { name: 'title', type: 'string' },
    { name: 'createdAt', type: 'datetime', options: ['isReadOnly'] },
    { name: 'updatedAt', type: 'datetime', options: ['isReadOnly'] },
  ];
  const referenceService = {
    reduceReferenceFields: jest.fn(
      (_template: unknown[], data: Record<string, unknown>) => data,
    ),
    getHandleFilter: jest.fn(() => ({ handle: 3 })),
  };
  const payloadService = new GenericPayloadService(referenceService as never);
  const fieldPermissions = {
    getTemplates: jest.fn(() => Promise.resolve(template)),
    assertPayloadAccess: jest.fn<(...args: unknown[]) => Promise<void>>(() =>
      Promise.reject(new Error('stop')),
    ),
  };
  const updateConflictService = {
    extractConcurrencyMetadata: jest.fn(
      (data: Record<string, unknown>, options: Record<string, unknown>) => ({
        data,
        concurrency: options,
      }),
    ),
  };
  const em = {
    findOne: jest
      .fn<() => Promise<Record<string, unknown> | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ handle: 3, title: 'Before' }),
  };

  const service = new GenericEntityMutationService(
    em as never,
    { getEntityTemplate: jest.fn(() => template) } as never,
    {
      getEntityClass: jest.fn(() => class TestEntity {}),
      buildPopulate: jest.fn(() => []),
    } as never,
    {} as never,
    payloadService,
    {
      applyEntityVisibilityFilter: jest.fn((filter: object) => filter),
    } as never,
    referenceService as never,
    {} as never,
    {
      loadUserHandles: jest.fn(() => Promise.resolve([])),
    } as never,
    {
      captureSubmittedChangeLogPayload: jest.fn(
        (_template: unknown[], data: Record<string, unknown>) => data,
      ),
    } as never,
    updateConflictService as never,
    {} as never,
    {
      splitPayload: jest.fn((data: Record<string, unknown>) => ({
        data,
        customFields: {},
      })),
      hydrateRecords: jest.fn(() => Promise.resolve()),
    } as never,
    {
      extractPayload: jest.fn(() => ({})),
    } as never,
    fieldPermissions as never,
  );

  return {
    fieldPermissions,
    service,
    updateConflictService,
  };
}

describe('GenericEntityMutationService client payload sanitization', () => {
  it('sanitizes create payloads before field-permission checks', async () => {
    const { fieldPermissions, service } = createSubject();

    await expect(
      service.create(
        'company',
        { ...timestampedPayload } as never,
        { handle: 1 } as never,
        {},
      ),
    ).rejects.toThrow('stop');

    expect(fieldPermissions.assertPayloadAccess).toHaveBeenCalledWith(
      { handle: 1 },
      'company',
      { title: 'Changed' },
      'insert',
      { title: 'Changed' },
      expect.any(Array),
    );
  });

  it('sanitizes update payloads before concurrency and field-permission processing', async () => {
    const { fieldPermissions, service, updateConflictService } =
      createSubject();

    await expect(
      service.update(
        'company',
        3,
        { ...timestampedPayload } as never,
        { handle: 1 } as never,
        [],
        {},
        { expectedUpdatedAt: '2026-07-23T10:01:16.189Z' },
      ),
    ).rejects.toThrow('stop');

    expect(
      updateConflictService.extractConcurrencyMetadata,
    ).toHaveBeenCalledWith(
      { title: 'Changed' },
      { expectedUpdatedAt: '2026-07-23T10:01:16.189Z' },
    );
    expect(fieldPermissions.assertPayloadAccess).toHaveBeenCalledWith(
      { handle: 1 },
      'company',
      { title: 'Changed' },
      'update',
      { handle: 3, title: 'Changed' },
      expect.any(Array),
    );
  });
});
