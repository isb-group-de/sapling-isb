import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type SystemRequestContext = {
  requestId: string;
  correlationId: string;
};

const requestContext = new AsyncLocalStorage<SystemRequestContext>();

export function getSystemRequestContext(): SystemRequestContext | undefined {
  return requestContext.getStore();
}

export function createSystemRequestContextMiddleware() {
  return (request: Request, response: Response, next: NextFunction): void => {
    const incomingRequestId = normalizeId(request.header('x-request-id'));
    const incomingCorrelationId = normalizeId(
      request.header('x-correlation-id'),
    );
    const context = {
      requestId: incomingRequestId || randomUUID(),
      correlationId: incomingCorrelationId || incomingRequestId || randomUUID(),
    };
    Object.assign(request, { systemRequestContext: context });
    response.setHeader('X-Request-ID', context.requestId);
    response.setHeader('X-Correlation-ID', context.correlationId);
    requestContext.run(context, next);
  };
}

function normalizeId(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return /^[a-zA-Z0-9._:-]{8,64}$/.test(normalized) ? normalized : null;
}
