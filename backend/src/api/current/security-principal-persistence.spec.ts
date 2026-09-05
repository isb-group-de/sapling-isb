import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Jest replaces MikroORM with mocks. Run the persistence regression with the
// installed ORM in a separate process so real change tracking stays covered.
it('keeps principal reads and unrelated writes free of person changes', () => {
  const backend = path.resolve(__dirname, '../../..');
  expect(() =>
    execFileSync(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        'test-support/security-principal-persistence.cjs',
      ],
      { cwd: backend, timeout: 30_000, stdio: 'pipe' },
    ),
  ).not.toThrow();
}, 35_000);
