import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readDocumentStorageUsage } from './document-storage.service';

describe('document storage usage', () => {
  let storageRoot: string;

  beforeEach(async () => {
    storageRoot = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'sapling-document-storage-'),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(storageRoot, { recursive: true, force: true });
  });

  it('sums files recursively and groups them by entity directory', async () => {
    await fs.promises.mkdir(path.join(storageRoot, 'ticket', 'nested'), {
      recursive: true,
    });
    await fs.promises.mkdir(path.join(storageRoot, 'company'));
    await fs.promises.writeFile(
      path.join(storageRoot, 'ticket', 'first'),
      '12345',
    );
    await fs.promises.writeFile(
      path.join(storageRoot, 'ticket', 'nested', 'second'),
      '123',
    );
    await fs.promises.writeFile(
      path.join(storageRoot, 'company', 'third'),
      '12',
    );
    await fs.promises.writeFile(
      path.join(storageRoot, 'ignored-root-file'),
      '123456',
    );

    await expect(readDocumentStorageUsage(storageRoot)).resolves.toEqual({
      totalSize: 10,
      totalFileCount: 3,
      entityCount: 2,
      entities: [
        { entityHandle: 'ticket', size: 8, fileCount: 2 },
        { entityHandle: 'company', size: 2, fileCount: 1 },
      ],
    });
  });

  it('returns an empty result when the storage directory does not exist', async () => {
    await fs.promises.rm(storageRoot, { recursive: true, force: true });

    await expect(readDocumentStorageUsage(storageRoot)).resolves.toEqual({
      totalSize: 0,
      totalFileCount: 0,
      entityCount: 0,
      entities: [],
    });
  });
});
