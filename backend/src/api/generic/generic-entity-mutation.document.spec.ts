const mockCaptureStoredDocumentFileDescriptor = jest.fn(() => ({
  entityHandle: 'ticket',
  storedPath: 'document-guid',
}));
const mockDeleteStoredDocumentFile = jest.fn(async () => undefined);

jest.mock('../document/document-storage.util', () => ({
  captureStoredDocumentFileDescriptor: mockCaptureStoredDocumentFileDescriptor,
  deleteStoredDocumentFile: mockDeleteStoredDocumentFile,
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import {
  GenericEntityMutationService,
  type GenericPostCommitTask,
} from './generic-entity-mutation.service';

describe('GenericEntityMutationService document cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues the physical file deletion only after the document row is deleted', async () => {
    const item = {
      handle: 9,
      path: 'document-guid',
      entity: { handle: 'ticket' },
    };
    const em = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(item)
        .mockResolvedValueOnce({ handle: 'document' }),
    };
    const mutationService = {
      applyBeforeScript: jest.fn(async () => item),
      deleteAndFlush: jest.fn(async () => 1),
      applyAfterScript: jest.fn(async () => item),
    };
    const service = new GenericEntityMutationService(
      em as never,
      { getEntityTemplate: jest.fn(() => []) } as never,
      { getEntityClass: jest.fn(() => class Document {}) } as never,
      mutationService as never,
      {} as never,
      {
        applyEntityVisibilityFilter: jest.fn((filter: object) => filter),
        checkTopLevelPermission: jest.fn(),
      } as never,
      { getHandleFilter: jest.fn(() => ({ handle: 9 })) } as never,
      {} as never,
      {
        loadUserHandles: jest.fn(async () => []),
        notifyUsers: jest.fn(async () => undefined),
      } as never,
      {
        captureEntityChangeLogPayload: jest.fn(() => ({ handle: 9 })),
        safeStoreChangeLog: jest.fn(async () => undefined),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
    );
    const postCommitTasks: GenericPostCommitTask[] = [];

    await service.delete(
      'document',
      9,
      { handle: 1 } as never,
      {},
      { postCommitTasks },
    );

    expect(mutationService.deleteAndFlush).toHaveBeenCalledTimes(1);
    expect(mockCaptureStoredDocumentFileDescriptor).toHaveBeenCalledWith(item);
    expect(mockDeleteStoredDocumentFile).not.toHaveBeenCalled();

    const cleanupTask = postCommitTasks.find(
      (task) => task.label === 'documentFileDelete',
    );
    expect(cleanupTask).toBeDefined();
    await cleanupTask?.operation();

    expect(mockDeleteStoredDocumentFile).toHaveBeenCalledWith({
      entityHandle: 'ticket',
      storedPath: 'document-guid',
    });
  });
});
