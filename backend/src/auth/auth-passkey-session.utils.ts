import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { PasskeyRequestContext } from './auth-passkey.service';

const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

type PasskeyRegistrationSessionPayload = {
  challenge: string;
  context: PasskeyRequestContext;
  createdAt: number;
};

type PasskeyLoginSessionPayload = PasskeyRegistrationSessionPayload & {
  personHandle: number;
  rememberMe: boolean;
};

type PasskeySessionData = {
  passkeyRegistration?: PasskeyRegistrationSessionPayload;
  passkeyLogin?: PasskeyLoginSessionPayload;
};

export function getPasskeySession(req: Request): PasskeySessionData {
  return (req.session ?? {}) as unknown as PasskeySessionData;
}

function assertFresh<T extends { createdAt: number }>(
  payload: T | undefined,
): T {
  if (!payload || Date.now() - payload.createdAt > PASSKEY_CHALLENGE_TTL_MS) {
    throw new BadRequestException('login.passkeyChallengeExpired');
  }
  return payload;
}

export function assertFreshPasskeyRegistrationSession(req: Request) {
  return assertFresh(getPasskeySession(req).passkeyRegistration);
}

export function assertFreshPasskeyLoginSession(req: Request) {
  return assertFresh(getPasskeySession(req).passkeyLogin);
}

export function clearPasskeyRegistrationSession(req: Request): void {
  delete getPasskeySession(req).passkeyRegistration;
}

export function clearPasskeyLoginSession(req: Request): void {
  delete getPasskeySession(req).passkeyLogin;
}
