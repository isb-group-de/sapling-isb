import { BadRequestException } from '@nestjs/common';

export const EMPTY_EVENT_BUFFER_DURATION = '00:00:00';
export const EVENT_BUFFER_INTERVAL_MINUTES = 15;

const DURATION_PATTERN = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/;

export function normalizeEventBufferDuration(value: unknown): string {
  if (value == null || value === '') {
    return EMPTY_EVENT_BUFFER_DURATION;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('event.invalidBufferDuration');
  }

  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new BadRequestException('event.invalidBufferDuration');
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3] ?? '0', 10);
  if (
    hours > 23 ||
    seconds !== 0 ||
    minutes % EVENT_BUFFER_INTERVAL_MINUTES !== 0
  ) {
    throw new BadRequestException('event.invalidBufferDuration');
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export function normalizeEventBufferMutationPayload<
  T extends Record<string, any>,
>(entityHandle: string, payload: T): T {
  if (entityHandle !== 'event') {
    return payload;
  }

  const nextPayload: Record<string, any> = { ...payload };
  for (const field of ['preparationDuration', 'followUpDuration'] as const) {
    if (Object.prototype.hasOwnProperty.call(nextPayload, field)) {
      nextPayload[field] = normalizeEventBufferDuration(nextPayload[field]);
    }
  }

  return nextPayload as T;
}
