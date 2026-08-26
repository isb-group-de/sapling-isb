import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  DocumentStorageDto,
  DocumentStorageEntityDto,
} from '../dto/document-storage.dto';

const DOCUMENT_STORAGE_ROOT = path.resolve(__dirname, '../../../../storage');

type DirectoryUsage = {
  size: number;
  fileCount: number;
};

async function readDirectoryUsage(directory: string): Promise<DirectoryUsage> {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  let size = 0;
  let fileCount = 0;

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await readDirectoryUsage(entryPath);
      size += nested.size;
      fileCount += nested.fileCount;
      continue;
    }

    if (entry.isFile()) {
      const stats = await fs.promises.stat(entryPath);
      size += stats.size;
      fileCount += 1;
    }
  }

  return { size, fileCount };
}

export async function readDocumentStorageUsage(
  storageRoot: string,
): Promise<DocumentStorageDto> {
  let rootEntries: fs.Dirent[];

  try {
    rootEntries = await fs.promises.readdir(storageRoot, {
      withFileTypes: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { totalSize: 0, totalFileCount: 0, entityCount: 0, entities: [] };
    }
    throw error;
  }

  const entities: DocumentStorageEntityDto[] = [];
  for (const entry of rootEntries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue;
    }

    const usage = await readDirectoryUsage(path.join(storageRoot, entry.name));
    entities.push({
      entityHandle: entry.name,
      size: usage.size,
      fileCount: usage.fileCount,
    });
  }

  entities.sort(
    (left, right) =>
      right.size - left.size ||
      left.entityHandle.localeCompare(right.entityHandle),
  );

  return {
    totalSize: entities.reduce((sum, entity) => sum + entity.size, 0),
    totalFileCount: entities.reduce((sum, entity) => sum + entity.fileCount, 0),
    entityCount: entities.length,
    entities,
  };
}

@Injectable()
export class DocumentStorageService {
  async getDocumentStorage(): Promise<DocumentStorageDto> {
    const usage = await readDocumentStorageUsage(DOCUMENT_STORAGE_ROOT);
    return { ...usage, entities: usage.entities.slice(0, 9) };
  }

  async getDocumentStorageEntities(): Promise<DocumentStorageEntityDto[]> {
    return (await readDocumentStorageUsage(DOCUMENT_STORAGE_ROOT)).entities;
  }
}
