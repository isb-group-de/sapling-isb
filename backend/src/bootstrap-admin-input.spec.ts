import { parseBootstrapAdminInput } from './bootstrap-admin-input';

function input(loginName: string, password: string): string {
  return `${Buffer.from(loginName).toString('base64')}\n${Buffer.from(password).toString('base64')}\n`;
}

describe('parseBootstrapAdminInput', () => {
  it('decodes a valid administrator input without changing its password', () => {
    expect(
      parseBootstrapAdminInput(input('sapling.admin', 'A long ! password 42')),
    ).toEqual({
      loginName: 'sapling.admin',
      password: 'A long ! password 42',
    });
  });

  it('rejects short passwords', () => {
    expect(() => parseBootstrapAdminInput(input('admin', 'too-short'))).toThrow(
      'at least 12 characters',
    );
  });

  it('rejects long but weak passwords', () => {
    expect(() =>
      parseBootstrapAdminInput(input('admin', 'onlylowercasepassword')),
    ).toThrow('three character classes');
  });

  it('rejects unsupported login names and additional lines', () => {
    expect(() =>
      parseBootstrapAdminInput(input('bad login', 'long-enough-password')),
    ).toThrow('supported characters');
    expect(() =>
      parseBootstrapAdminInput(
        `${input('admin', 'long-enough-password')}extra\n`,
      ),
    ).toThrow('exactly two lines');
  });
});
