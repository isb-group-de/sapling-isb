import * as fs from 'fs';
import * as path from 'path';

export type StoredDocumentFileDescriptor = {
  entityHandle: string;
  storedPath: string;
};

const DOCUMENT_STORAGE_ROOT = path.resolve(__dirname, '../../../storage');
const SAFE_ENTITY_HANDLE = /^[A-Za-z0-9_-]+$/;

export function getDocumentStorageDirectory(entityHandle: string): string {
  if (!SAFE_ENTITY_HANDLE.test(entityHandle)) {
    throw new Error(`Invalid document storage entity handle: ${entityHandle}`);
  }

  return path.join(DOCUMENT_STORAGE_ROOT, entityHandle);
}

export function getDocumentStorageFilePath(
  entityHandle: string,
  storedPath: string,
): string {
  if (
    !storedPath ||
    storedPath === '.' ||
    storedPath === '..' ||
    path.basename(storedPath) !== storedPath
  ) {
    throw new Error('Invalid stored document path');
  }

  return path.join(getDocumentStorageDirectory(entityHandle), storedPath);
}

export function captureStoredDocumentFileDescriptor(
  document: Record<string, unknown>,
): StoredDocumentFileDescriptor | null {
  const entity = document.entity;
  const entityHandle =
    typeof entity === 'string'
      ? entity
      : entity && typeof entity === 'object'
        ? (entity as { handle?: unknown }).handle
        : null;
  const storedPath = document.path;

  if (typeof entityHandle !== 'string' || typeof storedPath !== 'string') {
    return null;
  }

  return { entityHandle, storedPath };
}

/** Removes one opaque storage file after its DocumentItem was committed deleted. */
export async function deleteStoredDocumentFile(
  descriptor: StoredDocumentFileDescriptor,
): Promise<void> {
  const filePath = getDocumentStorageFilePath(
    descriptor.entityHandle,
    descriptor.storedPath,
  );

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }
}
