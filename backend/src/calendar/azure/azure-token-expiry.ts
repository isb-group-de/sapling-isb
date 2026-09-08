/** Expiry is a refresh scheduling hint; Microsoft Graph still authenticates the token. */
export function azureTokenNeedsRefresh(
  token: string,
  now = Date.now(),
): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp?: unknown };
    return (
      typeof payload.exp === 'number' &&
      Number.isFinite(payload.exp) &&
      payload.exp * 1000 <= now + 60_000
    );
  } catch {
    return false;
  }
}
