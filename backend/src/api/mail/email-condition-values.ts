function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function matchesConfiguredValue(
  value: unknown,
  expected: string,
): boolean {
  const expectedBoolean = parseConfiguredBoolean(expected);
  if (expectedBoolean !== null) {
    return isBooleanTrue(value) === expectedBoolean;
  }

  return valueCandidates(value).some((candidate) => candidate === expected);
}

export function parseConfiguredBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return null;
}

export function isBooleanTrue(value: unknown): boolean {
  if (value === true) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  if (Array.isArray(value)) {
    return value.some((entry) => isBooleanTrue(entry));
  }

  if (
    isRecord(value) &&
    Object.prototype.hasOwnProperty.call(value, 'handle')
  ) {
    return isBooleanTrue(value.handle);
  }

  return false;
}

export function valueCandidates(value: unknown): string[] {
  if (value == null) {
    return [''];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => valueCandidates(entry));
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return [String(value)];
  }

  if (isRecord(value)) {
    const handle = value.handle;
    if (
      typeof handle === 'string' ||
      typeof handle === 'number' ||
      typeof handle === 'boolean'
    ) {
      return [String(handle)];
    }
  }

  return [JSON.stringify(value)];
}
