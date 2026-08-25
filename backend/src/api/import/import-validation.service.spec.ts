import { ImportValidationService } from './import-validation.service';

describe('ImportValidationService', () => {
  function createService(
    em: unknown = { findOne: jest.fn() },
    importBatchQueryService: unknown = {},
  ) {
    return new ImportValidationService(
      em as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      importBatchQueryService as never,
    );
  }

  it('hydrates the import user permissions for queued validation jobs', async () => {
    const currentUser = { handle: 7, roles: [] };
    const em = {
      findOne: jest.fn(() => Promise.resolve(currentUser)),
    };
    const service = createService(em);

    const result = await (
      service as unknown as {
        findImportUser(userHandle: number): Promise<unknown>;
      }
    ).findImportUser(7);

    expect(result).toBe(currentUser);
    expect(em.findOne).toHaveBeenCalledWith(
      expect.any(Function),
      { handle: 7 },
      {
        populate: [
          'company',
          'roles',
          'roles.stage',
          'roles.permissions',
          'roles.permissions.entity',
          'roles.permissions.fieldPermissions',
        ],
      },
    );
  });

  it('ignores failed validation jobs when the import batch was deleted', async () => {
    const flush = jest.fn();
    const service = createService(
      { flush },
      { tryFindBatch: jest.fn(() => Promise.resolve(null)) },
    );

    await expect(
      (
        service as unknown as {
          markBatchJobFailed(handle: number, error: unknown): Promise<void>;
        }
      ).markBatchJobFailed(42, new Error('boom')),
    ).resolves.toBeUndefined();

    expect(flush).not.toHaveBeenCalled();
  });

  it('records validation failures on batches that still exist', async () => {
    const batch = {
      status: 'validating',
      currentOperation: 'validation',
      completedAt: new Date(),
    };
    const flush = jest.fn();
    const service = createService(
      { flush },
      { tryFindBatch: jest.fn(() => Promise.resolve(batch)) },
    );

    await (
      service as unknown as {
        markBatchJobFailed(handle: number, error: unknown): Promise<void>;
      }
    ).markBatchJobFailed(42, new Error('boom'));

    expect(batch).toMatchObject({
      status: 'validationFailed',
      currentOperation: 'validation',
      completedAt: null,
      lastError: 'boom',
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('does not permission-check an imported handle as writable field data', async () => {
    const currentUser = { handle: 7, roles: [] };
    const row = { rawData: { handle: 17, name: 'Acme' } };
    const batch = {
      handle: 42,
      targetEntity: { handle: 'company' },
      source: null,
      importTemplate: null,
      externalKeyColumns: [],
      genericReferenceMapping: null,
      mapping: {},
      processedCount: 0,
      readyCount: 0,
      errorCount: 0,
    };
    const fieldPermissions = {
      applyTemplateAccess: jest.fn(
        (_user: unknown, _entityHandle: string, templates: unknown[]) =>
          templates,
      ),
      assertPayloadAccess: jest.fn(() => Promise.resolve()),
    };
    const em = {
      findOne: jest.fn(() => Promise.resolve(currentUser)),
      find: jest.fn(() => Promise.resolve([row])),
      flush: jest.fn(() => Promise.resolve()),
    };
    const service = new ImportValidationService(
      em as never,
      { getEntityTemplate: jest.fn(() => []) } as never,
      {
        appendCustomFieldTemplates: jest.fn(() => Promise.resolve([])),
      } as never,
      {
        buildPayload: jest.fn(() =>
          Promise.resolve({ handle: 17, name: 'Acme' }),
        ),
      } as never,
      {} as never,
      { applyStrategies: jest.fn(() => Promise.resolve()) } as never,
      {
        validatePrimitiveValues: jest.fn(),
        getMissingRequiredFieldNames: jest.fn(() => []),
      } as never,
      {} as never,
      fieldPermissions as never,
    );

    await (
      service as unknown as {
        validateBatch(batchValue: unknown, userHandle: number): Promise<void>;
      }
    ).validateBatch(batch, 7);

    expect(fieldPermissions.assertPayloadAccess).toHaveBeenCalledWith(
      currentUser,
      'company',
      { name: 'Acme' },
      'update',
    );
    expect(row).toMatchObject({
      payload: { handle: 17, name: 'Acme' },
      action: 'updated',
      status: 'ready',
    });
  });
});
