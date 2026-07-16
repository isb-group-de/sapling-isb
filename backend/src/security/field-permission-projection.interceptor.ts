import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { from, mergeMap, Observable } from 'rxjs';
import type { PersonItem } from '../entity/PersonItem';
import { ENTITY_REGISTRY } from '../entity/global/entity.registry';
import { FieldPermissionService } from '../api/current/field-permission.service';
import { GenericSanitizerService } from '../api/generic/generic-sanitizer.service';

/** Projects registered entity instances returned by authenticated controllers. */
@Injectable()
export class FieldPermissionProjectionInterceptor implements NestInterceptor {
  private readonly entityHandleByClass = new Map<Function, string>(
    ENTITY_REGISTRY.map((entry) => [entry.class as Function, entry.name]),
  );

  constructor(
    private readonly fieldPermissions: FieldPermissionService,
    private readonly sanitizer: GenericSanitizerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const currentUser = request.user as PersonItem | undefined;
    if (!currentUser) return next.handle();

    return next
      .handle()
      .pipe(
        mergeMap((value) =>
          from(this.projectValue(value, currentUser, new WeakMap())),
        ),
      );
  }

  private async projectValue(
    value: unknown,
    currentUser: PersonItem,
    visited: WeakMap<object, unknown>,
  ): Promise<unknown> {
    if (value == null || typeof value !== 'object') return value;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    const cached = visited.get(value);
    if (cached !== undefined) return cached;

    if (Array.isArray(value)) {
      const projected: unknown[] = [];
      visited.set(value, projected);
      for (const item of value) {
        projected.push(await this.projectValue(item, currentUser, visited));
      }
      return projected;
    }

    const entityHandle =
      this.entityHandleByClass.get(value.constructor) ??
      ENTITY_REGISTRY.find((entry) => value instanceof entry.class)?.name;
    if (entityHandle) {
      const template = await this.fieldPermissions.getTemplates(entityHandle);
      const projected = this.sanitizer.projectEntityResult(
        entityHandle,
        value,
        currentUser,
        template,
      );
      visited.set(value, projected);
      return projected;
    }

    if (value.constructor !== Object) return value;
    const projected: Record<string, unknown> = {};
    visited.set(value, projected);
    for (const [key, entry] of Object.entries(value)) {
      projected[key] = await this.projectValue(entry, currentUser, visited);
    }
    return projected;
  }
}
