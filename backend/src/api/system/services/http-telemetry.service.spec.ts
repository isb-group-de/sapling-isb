import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { Request, Response } from 'express';
import {
  createHttpTelemetryMiddleware,
  HttpTelemetryService,
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
    await service.flush();

    expect(execute).toHaveBeenCalledTimes(2);
    const calls = execute.mock.calls.map((call) => call[1]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['person:1', 1, null, 'session', 'generic']),
        expect.arrayContaining(['token:42', 7, 42, 'apiToken', 'ai']),
      ]),
    );
    expect(JSON.stringify(calls)).not.toContain('secret');
    expect(JSON.stringify(calls)).not.toContain('never-store-this');
  });
});
