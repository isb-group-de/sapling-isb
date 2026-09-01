import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  buildErrorDiagnostics,
  stringifyErrorForLog,
} from './error-diagnostics.util';
import { SystemErrorRecorderService } from '../system/services/system-error-recorder.service';
import { getSystemRequestContext } from '../system/services/system-request-context';

type ErrorResponseBody = {
  statusCode: number;
  message: string;
  error?: string;
  requestId: string;
  path: string;
  method: string;
  timestamp: string;
  details?: unknown;
  technical?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorRecorder?: SystemErrorRecorderService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const requestContext = getSystemRequestContext();
    const requestId = requestContext?.requestId ?? 'unavailable';
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const normalizedResponse = this.normalizeExceptionResponse(
      exceptionResponse,
      status,
    );
    const diagnostics = buildErrorDiagnostics(exception);
    const responseTechnical = this.isRecord(normalizedResponse.technical)
      ? normalizedResponse.technical
      : {};
    const payload: ErrorResponseBody = {
      statusCode: status,
      message: normalizedResponse.message,
      error: normalizedResponse.error,
      requestId,
      path: request.originalUrl ?? request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      details: normalizedResponse.details,
      technical: {
        ...responseTechnical,
        ...(responseTechnical.exception == null
          ? { exception: diagnostics }
          : { httpException: diagnostics }),
      },
    };

    this.logException(request, payload, exception);
    if (status >= 500) {
      void this.errorRecorder?.record({
        source: 'backend',
        operation: `${request.method} ${this.requestRoutePath(request)}`,
        error: exception,
        requestId,
        correlationId: requestContext?.correlationId,
      });
    }
    response.status(status).json(payload);
  }

  private normalizeExceptionResponse(
    exceptionResponse: unknown,
    status: number,
  ): {
    message: string;
    error?: string;
    details?: unknown;
    technical?: unknown;
  } {
    if (typeof exceptionResponse === 'string') {
      return {
        message: exceptionResponse,
        error: undefined,
      };
    }

    if (this.isRecord(exceptionResponse)) {
      const messageValue = exceptionResponse.message;
      const message = Array.isArray(messageValue)
        ? messageValue.join(', ')
        : typeof messageValue === 'string'
          ? messageValue
          : status >= 500
            ? 'exception.serverException'
            : 'exception.unknownError';
      const error =
        typeof exceptionResponse.error === 'string'
          ? exceptionResponse.error
          : undefined;

      return {
        message,
        error,
        details: exceptionResponse.details,
        technical: exceptionResponse.technical,
      };
    }

    return {
      message:
        status >= 500 ? 'exception.serverException' : 'exception.unknownError',
      error: undefined,
    };
  }

  private logException(
    request: Request,
    payload: ErrorResponseBody,
    exception: unknown,
  ) {
    const errorPayload: unknown = JSON.parse(stringifyErrorForLog(exception));
    const logPayload = {
      requestId: payload.requestId,
      method: payload.method,
      path: payload.path,
      statusCode: payload.statusCode,
      user: this.getRequestUserHandle(request),
      query: request.query,
      body: this.redactValue(request.body),
      error: errorPayload,
    };

    global.log?.error?.('http exception:', logPayload);
  }

  private getRequestUserHandle(request: Request): string | number | null {
    const user = (request as Request & { user?: unknown }).user;
    if (!this.isRecord(user)) {
      return null;
    }

    const handle = user.handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }

  private requestRoutePath(request: Request): string {
    const route = request.route as unknown;
    if (this.isRecord(route) && typeof route.path === 'string') {
      return route.path;
    }
    return request.path || 'unknown';
  }

  private redactValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item));
    }

    if (!this.isRecord(value)) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        /password|secret|token|authorization|cookie/i.test(key)
          ? '[redacted]'
          : this.redactValue(entryValue),
      ]),
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
