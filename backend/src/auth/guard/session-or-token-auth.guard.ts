import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { isPublicGenericReadEntity } from '../public-generic-read-entities';

@Injectable()
export class SessionOrBearerAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

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
    return true;
  }
}
