import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  DriverException,
  type EntityManager,
  type EntityMetadata,
} from '@mikro-orm/core';
import type { PersonItem } from '../../../entity/PersonItem';
import { EntityTemplateDto } from '../../template/dto/entity-template.dto';
import type { FieldPermissionService } from '../../current/field-permission.service';
import type { GenericCustomFieldService } from '../generic-custom-field.service';
import type { GenericEntityMutationService } from '../generic-entity-mutation.service';
import type { GenericQueryService } from '../generic-query.service';
import type { GenericSanitizerService } from '../generic-sanitizer.service';
import type { GenericMergeAccessService } from './generic-merge-access.service';
import type { GenericMergeReferencesService } from './generic-merge-references.service';
import type { GenericMergeSystemReferencesService } from './generic-merge-system-references.service';
import { GenericMergeService } from './generic-merge.service';
import {
  isEmptyMergeValue,
  mergeSnapshotToken,
  type MergeRecord,
} from './generic-merge.util';

function field(
  name: string,
  overrides: Partial<EntityTemplateDto> = {},
): EntityTemplateDto {
  return Object.assign(
    new EntityTemplateDto(),
    { name, type: 'string', isPersistent: true },
    overrides,
  );
}

function setup() {
  const records: MergeRecord[] = [
    {
      handle: 10,
      title: 'Losing title',
      description: 'Source text',
      enabled: true,
      count: 7,
      secret: 'hidden',
      customFields: { note: 'Source note' },
    },
    {
      handle: 20,
      title: 'Winning title',
      description: ' ',
      enabled: false,
      count: 0,
      customFields: { note: null },
    },
  ];
  const templates = [
    field('handle'),
    field('title'),
    field('description'),
    field('enabled'),
    field('count'),
    field('secret', { options: ['isSecurity'] }),
    field('customFields.note'),
    field('createdAt'),
    field('children', { kind: '1:m', isReference: true }),
    field('system', { options: ['isReadOnly', 'isSystem'] }),
  ];
  const metadata = {
    props: templates.map((entry) => ({
      name: entry.name,
      kind: entry.kind ?? 'scalar',
    })),
  } as EntityMetadata;
  const events: string[] = [];
  const em = {
    getMetadata: () => ({ get: () => metadata }),
    transactional: jest.fn(async (operation: () => Promise<unknown>) => {
      const before = structuredClone(records);
      try {
        const result = await operation();
        events.push('commit');
        return result;
      } catch (error) {
        records.splice(0, records.length, ...before);
        events.push('rollback');
        throw error;
      }
    }),
  };
  const access = {
    assertEntityAccess: jest.fn(),
    assertRecordAccess: jest.fn(),
    loadRecord: jest.fn((_entity: string, handle: string) =>
      Promise.resolve(
        records.find((record) => record.handle === Number(handle))!,
      ),
    ),
  };
  const fields = {
    getTemplates: jest.fn(() => Promise.resolve(templates)),
    canAccessField: jest.fn(
      (_user, _entity, template: EntityTemplateDto, action: string) =>
        action === 'read' || !template.options.includes('isReadOnly'),
    ),
    assertPayloadAccess: jest.fn(() => Promise.resolve()),
  };
  const references = {
    transfer: jest.fn(() => {
      events.push('transfer');
      return Promise.resolve(new Map());
    }),
    validate: jest.fn(() => Promise.resolve()),
    assertNoReferences: jest.fn(() => Promise.resolve()),
  };
  const system = { assertNoReferences: jest.fn(() => Promise.resolve()) };
  const mutations = {
    delete: jest.fn((_entity: string, handle: number) => {
      events.push('delete');
      records.splice(
        records.findIndex((record) => record.handle === handle),
        1,
      );
      return Promise.resolve();
    }),
    update: jest.fn((_entity: string, handle: number, changes: object) => {
      events.push('update');
      return Promise.resolve(
        Object.assign(
          records.find((record) => record.handle === handle)!,
          changes,
        ),
      );
    }),
    schedulePostCommitTasks: jest.fn(() => {
      events.push('schedule');
    }),
  };
  const service = new GenericMergeService(
    em as unknown as EntityManager,
    { getEntityClass: () => 'Record' } as unknown as GenericQueryService,
    access as unknown as GenericMergeAccessService,
    fields as unknown as FieldPermissionService,
    {
      hydrateRecords: () => Promise.resolve(),
    } as unknown as GenericCustomFieldService,
    {
      projectEntityResult: (_entity: string, record: MergeRecord) => ({
        ...record,
        secret: undefined,
      }),
    } as unknown as GenericSanitizerService,
    references as unknown as GenericMergeReferencesService,
    system as unknown as GenericMergeSystemReferencesService,
    mutations as unknown as GenericEntityMutationService,
  );
  const pair = { loserHandle: '10', winnerHandle: '20' };
  const user = { handle: 1 } as PersonItem;
  return {
    service,
    pair,
    user,
    records,
    access,
    fields,
    mutations,
    references,
    system,
    events,
    metadata,
  };
}

describe('generic record merge', () => {
  it('keeps the authorization principal and uses the surviving identity for effects when merging the current person', async () => {
    const { service, pair, mutations, references, user } = setup();
    user.handle = 10;
    const effectActor: unknown = expect.objectContaining({ handle: 20 });
    const preview = await service.preview('person', pair, user);
    await service.merge(
      'person',
      { ...pair, previewToken: preview.previewToken, selections: {} },
      user,
      {},
    );
    expect(user.handle).toBe(10);
    expect(mutations.delete).toHaveBeenCalledWith(
      'person',
      10,
      user,
      expect.anything(),
      expect.objectContaining({
        effectActor,
      }),
    );
    expect(mutations.update).toHaveBeenCalledWith(
      'person',
      20,
      expect.anything(),
      user,
      [],
      expect.anything(),
      {},
      expect.objectContaining({
        effectActor,
      }),
    );
    expect(references.transfer).toHaveBeenCalledWith(
      'person',
      expect.anything(),
      expect.anything(),
      user,
      expect.anything(),
      expect.anything(),
      expect.any(Set),
      expect.any(Map),
      expect.objectContaining({ handle: 20 }),
    );
  });
  it.each([null, undefined, '', '  ', []])(
    'recognizes empty value %p',
    (value) => {
      expect(isEmptyMergeValue(value)).toBe(true);
    },
  );
  it.each([false, 0, '0', {}, ['value']])(
    'preserves nonempty value %p',
    (value) => {
      expect(isEmptyMergeValue(value)).toBe(false);
    },
  );

  it('compares readable fields and defaults to the winner except empty fields', async () => {
    const { service, pair, user } = setup();
    const preview = await service.preview('company', pair, user);
    expect(
      Object.fromEntries(
        preview.fields.map((entry) => [entry.property, entry.selectedSource]),
      ),
    ).toEqual({
      title: 'winner',
      description: 'loser',
      enabled: 'winner',
      count: 'winner',
      'customFields.note': 'loser',
      system: 'winner',
    });
    expect(
      preview.fields.find((entry) => entry.property === 'system')?.selectable,
    ).toBe(false);
    expect(
      preview.fields.some((entry) =>
        ['secret', 'handle', 'createdAt', 'children'].includes(entry.property),
      ),
    ).toBe(false);
  });

  it('resolves choices from server data and transfers references before deleting and scheduling work', async () => {
    const { service, pair, user, events, mutations } = setup();
    const preview = await service.preview('company', pair, user);
    const result = await service.merge(
      'company',
      {
        ...pair,
        previewToken: preview.previewToken,
        selections: {
          title: 'loser',
          description: 'winner',
          'customFields.note': 'winner',
        },
      },
      user,
      {},
    );
    expect(result.deletedHandle).toBe(10);
    expect(mutations.update.mock.calls[0][2]).toEqual({
      title: 'Losing title',
      'customFields.note': null,
    });
    expect(events).toEqual([
      'transfer',
      'delete',
      'update',
      'commit',
      'schedule',
    ]);
  });

  it.each(['10', '010'])(
    'rejects two handles identifying the same record (%s)',
    async (winnerHandle) => {
      const { service, pair, user, mutations } = setup();
      await expect(
        service.preview('company', { ...pair, winnerHandle }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mutations.delete).not.toHaveBeenCalled();
    },
  );

  it('requires a fresh comparison after either record or its custom fields changes', async () => {
    for (const index of [0, 1]) {
      const { service, pair, user, records, mutations } = setup();
      const preview = await service.preview('company', pair, user);
      records[index].customFields = { note: 'Changed concurrently' };
      await expect(
        service.merge(
          'company',
          { ...pair, previewToken: preview.previewToken, selections: {} },
          user,
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mutations.delete).not.toHaveBeenCalled();
      expect(mutations.schedulePostCommitTasks).not.toHaveBeenCalled();
    }
  });

  it.each([
    { secret: 'loser' },
    { handle: 'loser' },
    { children: 'loser' },
    { system: 'loser' },
    { title: 'arbitrary' },
    { unknown: 'winner' },
  ])('rejects unauthorized or arbitrary choices %p', async (selections) => {
    const { service, pair, user, mutations } = setup();
    const preview = await service.preview('company', pair, user);
    await expect(
      service.merge(
        'company',
        {
          ...pair,
          previewToken: preview.previewToken,
          selections: selections as never,
        },
        user,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mutations.delete).not.toHaveBeenCalled();
  });

  it('hides fields unreadable on either record and denies selecting them', async () => {
    const { service, pair, user, fields } = setup();
    fields.canAccessField.mockImplementation(
      (_user, _entity, template) => template.name !== 'title',
    );
    const preview = await service.preview('company', pair, user);
    expect(preview.fields.some((entry) => entry.property === 'title')).toBe(
      false,
    );
    await expect(
      service.merge(
        'company',
        {
          ...pair,
          previewToken: preview.previewToken,
          selections: { title: 'loser' },
        },
        user,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks entity authorization and reference failures before deleting anything', async () => {
    const { service, pair, user, access, references, mutations } = setup();
    access.assertEntityAccess.mockImplementationOnce(() => {
      throw new ForbiddenException();
    });
    await expect(service.preview('company', pair, user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const preview = await service.preview('company', pair, user);
    references.transfer.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      service.merge(
        'company',
        { ...pair, previewToken: preview.previewToken, selections: {} },
        user,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mutations.delete).not.toHaveBeenCalled();
  });

  it('rolls back the deleted source when a later update or validation fails', async () => {
    const { service, pair, user, records, mutations, references, events } =
      setup();
    const preview = await service.preview('company', pair, user);
    references.validate.mockRejectedValueOnce(new ConflictException());
    await expect(
      service.merge(
        'company',
        { ...pair, previewToken: preview.previewToken, selections: {} },
        user,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(records.map((record) => record.handle)).toEqual([10, 20]);
    expect(events).toEqual(['transfer', 'delete', 'update', 'rollback']);
    expect(mutations.schedulePostCommitTasks).not.toHaveBeenCalled();
  });

  it('binds snapshot tokens to record order and entity type without relying on timestamps', () => {
    const { metadata, records } = setup();
    const token = mergeSnapshotToken(
      'company',
      metadata,
      records[0],
      records[1],
    );
    expect(token).not.toBe(
      mergeSnapshotToken('company', metadata, records[1], records[0]),
    );
    expect(token).not.toBe(
      mergeSnapshotToken('ticket', metadata, records[0], records[1]),
    );
  });

  it.each([
    ['40001', 'recordMerge.stalePreview'],
    ['40P01', 'recordMerge.stalePreview'],
    ['23505', 'recordMerge.referenceConflict'],
    ['23503', 'recordMerge.referenceConflict'],
  ])(
    'returns a retryable conflict for PostgreSQL error %s after rollback',
    async (code, message) => {
      const { service, pair, user, references, mutations, records } = setup();
      const preview = await service.preview('company', pair, user);
      const failure = Object.assign(
        new DriverException(new Error('Database conflict')),
        { code },
      );
      references.validate.mockRejectedValueOnce(failure);
      await expect(
        service.merge(
          'company',
          {
            ...pair,
            previewToken: preview.previewToken,
            selections: {},
          },
          user,
          {},
        ),
      ).rejects.toThrow(message);
      expect(records.map((record) => record.handle)).toEqual([10, 20]);
      expect(mutations.schedulePostCommitTasks).not.toHaveBeenCalled();
    },
  );
});
