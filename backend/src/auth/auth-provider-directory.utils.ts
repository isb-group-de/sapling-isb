import type { ProviderUserDto } from './dto/provider-user.dto';

export type AzureGraphUser = {
  id?: string | null;
  displayName?: string | null;
  givenName?: string | null;
  surname?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

export type GoogleDirectoryUser = {
  id?: string | null;
  primaryEmail?: string | null;
  name?: {
    givenName?: string | null;
    familyName?: string | null;
    fullName?: string | null;
  } | null;
  suspended?: boolean | null;
};

export function normalizeProviderEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[^@\s<>]+@[^@\s<>]+$/.test(normalized)
    ? normalized
    : null;
}

export function mapAzureUserToProviderUser(
  user: AzureGraphUser,
): ProviderUserDto {
  const id = user.id?.trim() ?? '';
  const email =
    normalizeProviderEmail(user.mail) ??
    normalizeProviderEmail(user.userPrincipalName);
  const displayName =
    user.displayName?.trim() ||
    [user.givenName, user.surname].filter(Boolean).join(' ').trim() ||
    email ||
    id;

  return {
    provider: 'azure',
    id,
    displayName,
    firstName: user.givenName?.trim() || null,
    lastName: user.surname?.trim() || null,
    email,
    userPrincipalName: user.userPrincipalName?.trim() || null,
  };
}

export function mapGoogleUserToProviderUser(
  user: GoogleDirectoryUser,
): ProviderUserDto {
  const id = user.id?.trim() ?? '';
  const email = normalizeProviderEmail(user.primaryEmail);
  const displayName =
    user.name?.fullName?.trim() ||
    [user.name?.givenName, user.name?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    email ||
    id;

  return {
    provider: 'google',
    id,
    displayName,
    firstName: user.name?.givenName?.trim() || null,
    lastName: user.name?.familyName?.trim() || null,
    email,
    userPrincipalName: email,
  };
}

export function providerUserMatchesSearch(
  user: ProviderUserDto,
  search?: string,
): boolean {
  const normalizedSearch = search?.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [
    user.displayName,
    user.email,
    user.userPrincipalName,
    user.firstName,
    user.lastName,
    user.id,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
}

export function isAuthenticationProviderError(error: unknown): boolean {
  const status = getProviderErrorStatus(error);
  if (status === 401 || status === 403) {
    return true;
  }
  if (!isRecord(error)) {
    return false;
  }

  const message =
    typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    message.includes('token') ||
    message.includes('auth') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  );
}

export function isTransientProviderError(error: unknown): boolean {
  const status = getProviderErrorStatus(error);
  if (
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    (typeof status === 'number' && status >= 500)
  ) {
    return true;
  }
  if (!isRecord(error)) {
    return false;
  }

  const code =
    typeof error.code === 'string' ? error.code.toLowerCase() : undefined;
  if (
    code &&
    [
      'typeerror',
      'econnreset',
      'econnrefused',
      'etimedout',
      'enotfound',
      'eai_again',
      'und_err_connect_timeout',
      'und_err_headers_timeout',
      'und_err_socket',
    ].includes(code)
  ) {
    return true;
  }

  const message =
    typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('temporarily unavailable')
  );
}

function getProviderErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  return typeof error.statusCode === 'number'
    ? error.statusCode
    : typeof error.status === 'number'
      ? error.status
      : typeof error.code === 'number'
        ? error.code
        : isRecord(error.response) && typeof error.response.status === 'number'
          ? error.response.status
          : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
