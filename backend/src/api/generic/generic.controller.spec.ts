/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { describe, expect, it, jest } from '@jest/globals';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { Response } from 'express';

jest.mock('./generic.service', () => ({ GenericService: class {} }));
jest.mock('../../entity/PersonItem', () => ({ PersonItem: class {} }));

import { PersonItem } from '../../entity/PersonItem';
import { GenericController } from './generic.controller';

const createMockUser = (): PersonItem =>
  ({ handle: 1, username: 'tester' }) as unknown as PersonItem;
const asMock = (value: unknown): jest.Mock => value as jest.Mock;
const createMockResponse = (): Response =>
  ({
    setHeader: jest.fn(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as Response;

describe('GenericController', () => {
  it('prevents paginated entity data from being cached', () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      GenericController.prototype.findPaginated,
    ) as Array<{ name: string; value: string }>;

    expect(headers).toEqual(
      expect.arrayContaining([
        { name: 'Cache-Control', value: 'no-store' },
        { name: 'Pragma', value: 'no-cache' },
      ]),
    );
  });

  it('returns paginated entity data', async () => {
    const expected = { items: [{ handle: 1 }], total: 1 };
    const genericService = { findAndCount: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };
    const query = {
      page: 2,
      limit: 5,
      filter: { active: true },
      orderBy: { name: 'ASC' },
      relations: ['person'],
      fields: ['handle', 'name'],
    };

    await expect(
      controller.findPaginated(req as never, 'ticket', query),
    ).resolves.toBe(expected);
    expect(asMock(genericService.findAndCount)).toHaveBeenCalledWith(
      'ticket',
      query.filter,
      query.page,
      query.limit,
      query.orderBy,
      req.user,
      query.relations,
      query.fields,
    );
  });

  it('downloads entity data as JSON', async () => {
    const genericService = {
      downloadJSON: jest.fn(async () => '[{"handle":1}]'),
    };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };
    const res = createMockResponse();

    await controller.download(req as never, res, 'ticket', {
      filter: { active: true },
      orderBy: { name: 'ASC' },
      relations: ['person'],
    });

    expect(asMock(genericService.downloadJSON)).toHaveBeenCalledWith(
      'ticket',
      { active: true },
      { name: 'ASC' },
      req.user,
      ['person'],
    );
    expect(res.setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'application/json',
    );
    expect(res.setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      'attachment; filename="ticket.json"',
    );
    expect(res.send).toHaveBeenCalledWith('[{"handle":1}]');
  });

  it('creates an entity entry', async () => {
    const expected = { handle: 3 };
    const genericService = { create: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };
    const payload = { title: 'New ticket' };

    await expect(
      controller.create(req as never, 'ticket', payload),
    ).resolves.toBe(expected);
    expect(asMock(genericService.create)).toHaveBeenCalledWith(
      'ticket',
      payload,
      req.user,
      {},
    );
  });

  it('updates an entity entry', async () => {
    const expected = { handle: 3, title: 'Updated ticket' };
    const genericService = { update: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };
    const payload = { title: 'Updated ticket' };

    await expect(
      controller.update(
        req as never,
        'ticket',
        '3',
        { relations: ['person'], merge: false },
        payload,
      ),
    ).resolves.toBe(expected);
    expect(asMock(genericService.update)).toHaveBeenCalledWith(
      'ticket',
      '3',
      payload,
      req.user,
      ['person'],
      {},
      { expectedUpdatedAt: undefined, merge: false },
    );
  });

  it('bulk updates selected entity entries', async () => {
    const expected = { updatedCount: 2, handles: ['3', '4'] };
    const genericService = { bulkUpdate: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };
    const payload = {
      targets: [{ handle: '3' }, { handle: '4' }],
      changes: { isActive: false },
    };

    await expect(
      controller.bulkUpdate(req as never, 'company', payload),
    ).resolves.toBe(expected);
    expect(asMock(genericService.bulkUpdate)).toHaveBeenCalledWith(
      'company',
      payload,
      req.user,
      {},
    );
  });

  it('deletes an entity entry', async () => {
    const expected = { action: 'deleted' };
    const genericService = { delete: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };

    await expect(controller.delete(req as never, 'ticket', '3')).resolves.toBe(
      expected,
    );
    expect(asMock(genericService.delete)).toHaveBeenCalledWith(
      'ticket',
      '3',
      req.user,
      {},
      [],
    );
  });

  it('returns the delete impact for an entity entry', async () => {
    const expected = {
      action: 'delete',
      references: [
        { name: 'positions', entityHandle: 'position', kind: '1:m' },
      ],
    };
    const genericService = { getDeleteImpact: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };

    await expect(
      controller.getDeleteImpact(req as never, 'ticket', '3'),
    ).resolves.toBe(expected);
    expect(asMock(genericService.getDeleteImpact)).toHaveBeenCalledWith(
      'ticket',
      '3',
      req.user,
    );
  });

  it('creates a reference for an entity entry', async () => {
    const expected = { success: true };
    const genericService = { createReference: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };

    await expect(
      controller.createReference(req as never, 'ticket', 'persons', {
        entityHandle: '3',
        referenceHandle: '8',
      }),
    ).resolves.toBe(expected);
    expect(asMock(genericService.createReference)).toHaveBeenCalledWith(
      'ticket',
      'persons',
      '3',
      '8',
      req.user,
      {},
    );
  });

  it('deletes a reference from an entity entry', async () => {
    const expected = { success: true };
    const genericService = { deleteReference: jest.fn(async () => expected) };
    const controller = new GenericController(genericService as never);
    const req = { user: createMockUser() };

    await expect(
      controller.deleteReference(req as never, 'ticket', 'persons', {
        entityHandle: '3',
        referenceHandle: '8',
      }),
    ).resolves.toBe(expected);
    expect(asMock(genericService.deleteReference)).toHaveBeenCalledWith(
      'ticket',
      'persons',
      '3',
      '8',
      req.user,
      {},
    );
  });
});
