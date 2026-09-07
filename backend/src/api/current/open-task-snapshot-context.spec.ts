import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Ordinary Jest tests mock MikroORM; this regression needs its real async contexts.
it('refreshes the inbox after the triggering transaction has committed', () => {
  execFileSync(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      'test-support/open-task-snapshot-context.cjs',
    ],
    {
      cwd: path.resolve(__dirname, '../../..'),
      timeout: 30_000,
      stdio: 'pipe',
    },
  );
}, 35_000);
