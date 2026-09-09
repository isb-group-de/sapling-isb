import { HttpException } from '@nestjs/common';

export function automationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isTerminalAutomationActionError(error: unknown): boolean {
  if (error instanceof HttpException) {
    const status = error.getStatus();
    return status >= 400 && status < 500;
  }
  return (
    error instanceof Error &&
    ['global.notActive', 'global.entityNotFound', 'global.notFound'].includes(
      error.message,
    )
  );
}

export function automationValuesEqual(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown =>
    value && typeof value === 'object' && 'handle' in value
      ? (value as { handle?: unknown }).handle
      : value;
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
