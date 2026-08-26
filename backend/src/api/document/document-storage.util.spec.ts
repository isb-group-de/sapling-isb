import * as fs from 'fs';
import * as path from 'path';
import {
  captureStoredDocumentFileDescriptor,
  deleteStoredDocumentFile,
  getDocumentStorageFilePath,
} from './document-storage.util';

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
  },
}));

describe('document storage utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('captures the opaque file descriptor from a loaded document relation', () => {
    expect(
      captureStoredDocumentFileDescriptor({
        entity: { handle: 'ticket' },
        path: 'document-guid',
      }),
    ).toEqual({ entityHandle: 'ticket', storedPath: 'document-guid' });
  });

  it('deletes the resolved storage file and tolerates an already missing file', async () => {
    jest
      .mocked(fs.promises.unlink)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      );
    const descriptor = { entityHandle: 'ticket', storedPath: 'document-guid' };

    await expect(deleteStoredDocumentFile(descriptor)).resolves.toBeUndefined();
    await expect(deleteStoredDocumentFile(descriptor)).resolves.toBeUndefined();

    expect(fs.promises.unlink).toHaveBeenCalledWith(
      getDocumentStorageFilePath('ticket', 'document-guid'),
    );
  });

  it('rejects traversal outside the entity storage directory', () => {
    expect(() =>
      getDocumentStorageFilePath('ticket', path.join('..', 'secret')),
    ).toThrow('Invalid stored document path');
    expect(() =>
      getDocumentStorageFilePath('../ticket', 'document-guid'),
    ).toThrow('Invalid document storage entity handle');
  });
});
