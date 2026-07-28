import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { performance } from 'perf_hooks';

@Injectable()
export class PerformanceTimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = performance.now();
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        appendServerTiming(
          response,
          `handler;dur=${(performance.now() - startedAt).toFixed(1)}`,
        );
      }),
    );
  }
}

export function appendServerTiming(
  response: Pick<Response, 'getHeader' | 'setHeader' | 'headersSent'>,
  value: string,
): void {
  if (response.headersSent) return;
  const existing = response.getHeader('Server-Timing');
  const prefix =
    typeof existing === 'string'
      ? existing
      : Array.isArray(existing)
        ? existing.join(', ')
        : '';
  response.setHeader('Server-Timing', prefix ? `${prefix}, ${value}` : value);
}
