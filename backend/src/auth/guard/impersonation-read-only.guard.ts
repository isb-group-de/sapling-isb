import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PersonItem } from '../../entity/PersonItem';
import { IMPERSONATION_READ_ONLY_KEY } from '../impersonation-read-only';

/**
 * Enforces a read-only policy while a session is impersonating another user.
 *
 * When `req.user._impersonator` is set, the original (real) administrator is
 * viewing the application *as* the target user. To prevent accidental data
 * changes performed under a foreign identity, every non-idempotent HTTP
 * request is rejected with 403, with the sole exception of the explicit
 * "stop impersonation" endpoint.
 *
 * This guard is registered globally via `APP_GUARD` in `AuthModule`. Since
 * NestJS global guards run *after* route guards have populated `req.user`
 * (via session deserialization), the impersonation flag is already set when
 * this guard executes.
 */
@Injectable()
export class ImpersonationReadOnlyGuard implements CanActivate {
  private static readonly READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  private static readonly ALLOWED_WRITE_SUFFIXES = [
    '/auth/impersonate/stop',
    '/auth/logout',
  ];

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as
      | (PersonItem & { _impersonator?: unknown })
      | undefined;

    if (!user || !user._impersonator) {
      return true;
    }

    const method = (req.method ?? 'GET').toUpperCase();
    if (ImpersonationReadOnlyGuard.READ_METHODS.has(method)) {
      return true;
    }

    const isReadOnlyRoute =
      this.reflector.getAllAndOverride<boolean>(IMPERSONATION_READ_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    if (isReadOnlyRoute) {
      return true;
    }

    const path = (req.path ?? req.originalUrl ?? req.url ?? '').split('?')[0];

    // All auth endpoints (login, logout, impersonate/stop, OAuth callbacks)
    // must always be reachable so users can recover from a stale impersonated
    // session by logging in or out.
    if (path.includes('/auth/')) {
      return true;
    }

    if (
      ImpersonationReadOnlyGuard.ALLOWED_WRITE_SUFFIXES.some((suffix) =>
        path.endsWith(suffix),
      )
    ) {
      return true;
    }

    throw new ForbiddenException('permission.readOnlyDuringImpersonation');
  }
}
