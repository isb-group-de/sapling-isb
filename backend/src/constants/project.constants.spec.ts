import { describe, expect, it } from '@jest/globals';
import { resolveSessionCookieSecure } from './project.constants';

describe('resolveSessionCookieSecure', () => {
  it('respects an explicit false value in production', () => {
    expect(resolveSessionCookieSecure('false', 'production')).toBe(false);
  });

  it('respects an explicit true value outside production', () => {
    expect(resolveSessionCookieSecure('true', 'development')).toBe(true);
  });

  it('defaults to secure cookies in production when not configured', () => {
    expect(resolveSessionCookieSecure(undefined, 'production')).toBe(true);
  });

  it('defaults to non-secure cookies outside production when not configured', () => {
    expect(resolveSessionCookieSecure(undefined, 'development')).toBe(false);
  });

  it('uses the production default for invalid configured values', () => {
    expect(resolveSessionCookieSecure('invalid', 'production')).toBe(true);
    expect(resolveSessionCookieSecure('invalid', 'development')).toBe(false);
  });
});
