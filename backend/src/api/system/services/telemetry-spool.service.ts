import { Injectable } from '@nestjs/common';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  LOG_OUTPUT_PATH,
  SYSTEM_TELEMETRY_SPOOL_MAX_MB,
} from '../../../constants/project.constants';

type SpoolKind = 'http' | 'system';

@Injectable()
export class TelemetrySpoolService {
  private readonly directory = path.resolve(LOG_OUTPUT_PATH, 'telemetry-spool');
  private readonly maxBytes = SYSTEM_TELEMETRY_SPOOL_MAX_MB * 1024 * 1024;
  private pendingFiles = 0;
  private pendingBytes = 0;
  private overflowed = false;

  getStatus() {
    return {
      path: this.directory,
      maxBytes: this.maxBytes,
      pendingFiles: this.pendingFiles,
      pendingBytes: this.pendingBytes,
      overflowed: this.overflowed,
    };
  }

  async write(kind: SpoolKind, payload: unknown): Promise<void> {
    try {
      await mkdir(this.directory, { recursive: true });
      const file = `${kind}-${Date.now()}-${randomUUID()}.json`;
      await writeFile(
        path.join(this.directory, file),
        JSON.stringify({ kind, createdAt: new Date().toISOString(), payload }),
        { encoding: 'utf8', flag: 'wx' },
      );
      await this.enforceLimit();
    } catch (error) {
      global.log?.error?.('telemetry spool write failed', error);
    }
  }

  async drain<T>(kind: SpoolKind, handler: (payload: T) => Promise<void>) {
    try {
      await mkdir(this.directory, { recursive: true });
      const files = (await readdir(this.directory))
        .filter((file) => file.startsWith(`${kind}-`) && file.endsWith('.json'))
        .sort();
      for (const file of files) {
        const fullPath = path.join(this.directory, file);
        const parsed = JSON.parse(await readFile(fullPath, 'utf8')) as {
          payload: T;
        };
        await handler(parsed.payload);
        await unlink(fullPath);
      }
      await this.refreshStatus();
    } catch (error) {
      global.log?.error?.('telemetry spool replay failed', error);
    }
  }

  private async enforceLimit() {
    const files = await this.describeFiles();
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (total <= this.maxBytes) break;
      await unlink(file.path);
      total -= file.size;
      this.overflowed = true;
    }
    await this.refreshStatus();
  }

  private async refreshStatus() {
    const files = await this.describeFiles();
    this.pendingFiles = files.length;
    this.pendingBytes = files.reduce((sum, file) => sum + file.size, 0);
  }

  private async describeFiles() {
    const names = (await readdir(this.directory)).filter((file) =>
      file.endsWith('.json'),
    );
    const files = await Promise.all(
      names.map(async (name) => {
        const filePath = path.join(this.directory, name);
        const details = await stat(filePath);
        return {
          path: filePath,
          size: details.size,
          modifiedAt: details.mtimeMs,
        };
      }),
    );
    return files.sort((left, right) => left.modifiedAt - right.modifiedAt);
  }
}
