import { azureTokenNeedsRefresh } from './azure-token-expiry';
const token = (exp: unknown) =>
  `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
describe('Azure refresh scheduling', () => {
  it('refreshes expired and soon-expiring tokens before calling Graph', () => {
    expect(azureTokenNeedsRefresh(token(100), 101_000)).toBe(true);
    expect(azureTokenNeedsRefresh(token(150), 101_000)).toBe(true);
    expect(azureTokenNeedsRefresh(token(1000), 101_000)).toBe(false);
  });
  it('leaves opaque and malformed tokens to provider authentication', () => {
    expect(azureTokenNeedsRefresh('opaque')).toBe(false);
    expect(azureTokenNeedsRefresh(token('123'))).toBe(false);
  });
});
