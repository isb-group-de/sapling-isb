import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { Request, Response } from 'express';
import {
  createHttpTelemetryMiddleware,
  HttpTelemetryService,
  resolveRequestKind,
  resolveResourceKey,
  resolveRouteGroup,
} from './http-telemetry.service';

describe('HTTP telemetry middleware', () => {
  it('leaves request body bytes available for downstream multipart parsers', () => {
    const body = Buffer.from('multipart body chunk');
    const request = Object.assign(new PassThrough(), {
      headers: { 'content-length': String(body.length) },
      path: '/api/document/upload/ticket/31',
      url: '/api/document/upload/ticket/31',
    });
    const response = Object.assign(new EventEmitter(), {
      write: jest.fn(() => true),
      end: jest.fn(),
      statusCode: 200,
      headersSent: false,
      writableFinished: false,
    });
    const record = jest.fn();
    const requestStarted = jest.fn();
    const requestFinished = jest.fn();
    const next = jest.fn();
    const middleware = createHttpTelemetryMiddleware({
      record,
      requestStarted,
      requestFinished,
    } as never);

    middleware(
      request as unknown as Request,
      response as unknown as Response,
      next,
    );

    request.write(body);

    const received: Buffer[] = [];
    request.on('data', (chunk: Buffer) => received.push(Buffer.from(chunk)));
    request.end();
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(requestStarted).toHaveBeenCalledTimes(1);
    expect(requestFinished).toHaveBeenCalledTimes(1);
    expect(Buffer.concat(received)).toEqual(body);
    expect(record).toHaveBeenCalledWith(
      request,
      200,
      expect.any(Number),
      body.length,
      0,
      'standard',
    );
  });
});

describe('HTTP telemetry privacy grouping', () => {
  it('keeps only an allowlisted top-level API group', () => {
    expect(resolveRouteGroup('/api/ai/chat/sessions/42?prompt=secret')).toBe(
      'ai',
    );
    expect(resolveRouteGroup('/api/generic/person?filter=email')).toBe(
      'generic',
    );
  });

  it('does not persist unknown concrete route segments', () => {
    expect(resolveRouteGroup('/api/private-customer-route/acme')).toBe('other');
  });

  it('classifies known streaming operations and bounded resources', () => {
    expect(
      resolveRequestKind({
        method: 'GET',
        baseUrl: '/api/current',
        route: { path: 'openTaskCountEvents' },
      } as never),
    ).toBe('stream');
    expect(
      resolveRequestKind({ method: 'GET', path: '/api/current/meta' } as never),
    ).toBe('standard');
    expect(
      resolveResourceKey({ params: { entityHandle: 'person' } } as never),
    ).toBe('person');
    expect(
      resolveResourceKey({
        params: { entityHandle: 'invalid/value' },
      } as never),
    ).toBe('');
  });

  it('attributes impersonated and API-token traffic without request details', async () => {
    const execute = jest.fn(
      (sql: string, parameters: unknown[]): Promise<unknown[]> => {
        void sql;
        void parameters;
        return Promise.resolve([]);
      },
    );
    const transaction = { getConnection: () => ({ execute }) };
    const em = {
      fork: () => ({
        transactional: (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      }),
    };
    const spool = {
      drain: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue(undefined),
      getStatus: () => ({}),
    };
    const service = new HttpTelemetryService(
      em as never,
      spool as never,
      {
        currentId: 'test',
        ensure: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    service.record(
      {
        path: '/api/generic/person/99?secret=value',
        user: { handle: 99, _impersonator: { handle: 1 } },
        headers: { authorization: 'Bearer never-store-this' },
      } as never,
      500,
      125,
      10,
      20,
    );
    service.record(
      {
        path: '/api/ai/chat',
        user: { handle: 7 },
        telemetry: { authKind: 'apiToken', apiTokenHandle: 42 },
      } as never,
      200,
      20,
      5,
      15,
    );
    service.record(
      {
        method: 'GET',
        baseUrl: '/api/current',
        route: { path: 'openTaskCountEvents' },
      } as never,
      499,
      5000,
      0,
      20,
      'stream',
    );
    await service.flush();

    expect(execute).toHaveBeenCalledTimes(1);
    const parameters = execute.mock.calls[0]?.[1];
    const buckets = JSON.parse(parameters?.[0] as string) as Array<
      Record<string, unknown>
    >;
    expect(buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributionKey: 'person:1',
          personHandle: 1,
          authKind: 'session',
          routeGroup: 'generic',
        }),
        expect.objectContaining({
          attributionKey: 'token:42',
          personHandle: 7,
          apiTokenHandle: 42,
          authKind: 'apiToken',
          routeGroup: 'ai',
        }),
        expect.objectContaining({
          operation: 'GET /api/current/openTaskCountEvents',
          requestKind: 'stream',
          clientErrorCount: 0,
          abortedCount: 1,
        }),
      ]),
    );
    expect(parameters?.[1]).toBe('test');
    expect(JSON.stringify(parameters)).not.toContain('secret');
    expect(JSON.stringify(parameters)).not.toContain('never-store-this');
  });
});
