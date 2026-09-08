import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

describe('AI application bootstrap with real runtime imports', () => {
  it('resolves every AI provider using the production TypeScript compiler and Nest injector', () => {
    const backend = resolve(__dirname, '../../..');
    const temporaryRoot = join(backend, '.tmp');
    mkdirSync(temporaryRoot, { recursive: true });
    const output = mkdtempSync(join(temporaryRoot, 'ai-bootstrap-'));
    try {
      execFileSync(
        process.execPath,
        [
          join(backend, 'node_modules/typescript/bin/tsc'),
          '-p',
          'tsconfig.build.json',
          '--outDir',
          output,
          '--incremental',
          'false',
          '--declaration',
          'false',
          '--sourceMap',
          'false',
        ],
        { cwd: backend, timeout: 90_000, encoding: 'utf8' },
      );
      const result = execFileSync(
        process.execPath,
        [join(output, 'api/ai/ai-module.bootstrap-check.js')],
        { cwd: backend, timeout: 30_000, encoding: 'utf8' },
      );
      expect(result).toMatch(
        /Nest DI verified: \d+ AI providers, \d+ controllers/,
      );
    } finally {
      // This is the exact directory returned by mkdtempSync inside backend/.tmp.
      rmSync(output, { recursive: true, force: true });
    }
  }, 120_000);
});
