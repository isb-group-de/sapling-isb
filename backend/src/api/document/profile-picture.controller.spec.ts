import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import type { Request } from 'express';
import { ProfilePictureController } from './profile-picture.controller';
import { ProfilePictureService } from './profile-picture.service';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { PROFILE_PICTURE_MAX_BYTES } from './profile-picture.util';

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

describe('ProfilePictureController HTTP contract', () => {
  let app: INestApplication;
  const person = { handle: 42 };
  const pictures = {
    list: jest.fn().mockResolvedValue([]),
    upload: jest.fn().mockResolvedValue({ handle: 7 }),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProfilePictureController],
      providers: [{ provide: ProfilePictureService, useValue: pictures }],
    })
      .overrideGuard(SessionOrBearerAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<
            Request & {
              user: { handle: number; _impersonator?: { handle: number } };
            }
          >();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.user = req.headers['x-test-impersonation']
            ? { ...person, _impersonator: { handle: 1 } }
            : person;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/current/profile-pictures')
      .expect(401);
    expect(pictures.list).not.toHaveBeenCalled();
  });

  it('offers self-service without generic person update permissions and prevents cached lists', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/current/profile-pictures')
      .set('Authorization', 'test')
      .expect('Cache-Control', 'private, no-store')
      .expect(200, []);
    expect(pictures.list).toHaveBeenCalledWith(person);
  });

  it('ignores attempts to override the target person and document type in multipart fields', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/current/profile-pictures')
      .set('Authorization', 'test')
      .field('reference', '999')
      .field('typeHandle', 'document')
      .attach('file', Buffer.from('image'), 'profile.png')
      .expect(201);
    expect(pictures.upload).toHaveBeenCalledWith(
      person,
      expect.objectContaining({ originalname: 'profile.png' }),
    );
  });

  it('enforces the multipart limit before invoking the service', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/current/profile-pictures')
      .set('Authorization', 'test')
      .attach('file', Buffer.alloc(PROFILE_PICTURE_MAX_BYTES + 1), 'large.png')
      .expect(413);
    expect(pictures.upload).not.toHaveBeenCalled();
  });

  it('blocks uploads and deletion while impersonating', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/current/profile-pictures')
      .set('Authorization', 'test')
      .set('x-test-impersonation', 'true')
      .attach('file', Buffer.from('image'), 'profile.png')
      .expect(403);
    await request(app.getHttpServer() as Server)
      .delete('/api/current/profile-pictures/7')
      .set('Authorization', 'test')
      .set('x-test-impersonation', 'true')
      .expect(403);
    expect(pictures.upload).not.toHaveBeenCalled();
    expect(pictures.remove).not.toHaveBeenCalled();
  });

  it('validates document identifiers', async () => {
    await request(app.getHttpServer() as Server)
      .delete('/api/current/profile-pictures/not-a-number')
      .set('Authorization', 'test')
      .expect(400);
    expect(pictures.remove).not.toHaveBeenCalled();
  });
});
