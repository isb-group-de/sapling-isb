import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { isPublicGenericReadEntity } from '../public-generic-read-entities';
import { performance } from 'perf_hooks';
import type { Response } from 'express';
import { appendServerTiming } from '../../api/common/performance-timing.interceptor';
import { PersonItem } from '../../entity/PersonItem';

@Injectable()
export class SessionOrBearerAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = performance.now();

    if (req.method === 'GET' && req.path === '/api/system/state') {
      return true;
    }

    if (
      req.method === 'GET' &&
      isPublicGenericReadEntity(req.params.entityHandle ?? '')
    ) {
      return true;
    }

    if (req.user) {
      (req as Request & { telemetry?: { authKind?: string } }).telemetry = {
        authKind: 'session',
      };
      appendServerTiming(
        response,
        `auth;dur=${(performance.now() - startedAt).toFixed(1)}`,
      );
      return true;
    }

    const authorization = req.headers.authorization?.trim() ?? '';
    if (!authorization) {
      throw new UnauthorizedException();
    }

    const [scheme, token] = authorization.split(/\s+/, 2);
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException();
    }

    const user = await this.authService.validateApiToken(token, req.ip ?? '');
    if (!user) {
      throw new UnauthorizedException();
    }

    req.user = user;
    const tokenHandle = (user as PersonItem & { _apiTokenHandle?: number })
      ._apiTokenHandle;
    (
      req as Request & {
        telemetry?: { authKind?: string; apiTokenHandle?: number };
      }
    ).telemetry = {
      authKind: 'apiToken',
      ...(typeof tokenHandle === 'number'
        ? { apiTokenHandle: tokenHandle }
        : {}),
    };
    appendServerTiming(
      response,
      `auth;dur=${(performance.now() - startedAt).toFixed(1)}`,
    );
    return true;
  }
}
