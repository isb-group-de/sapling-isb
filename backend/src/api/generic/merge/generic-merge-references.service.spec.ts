import { ConflictException } from '@nestjs/common';
import type { EntityManager, EntityMetadata } from '@mikro-orm/core';
import { CompanyItem } from '../../../entity/CompanyItem';
import { PersonItem } from '../../../entity/PersonItem';
import { EventItem } from '../../../entity/EventItem';
import { EntityTemplateDto } from '../../template/dto/entity-template.dto';
import type { TemplateService } from '../../template/template.service';
import type { GenericEntityMutationService } from '../generic-entity-mutation.service';
import type { GenericReferenceService } from '../generic-reference.service';
import type { GenericMergeAccessService } from './generic-merge-access.service';
import type { GenericMergeSystemReferencesService } from './generic-merge-system-references.service';
import { GenericMergeReferencesService } from './generic-merge-references.service';
import type { MergeRecord } from './generic-merge.util';

function collection(handles: number[]) {
  return {
    init: jest.fn(() => Promise.resolve()),
    getItems: () => handles.map((handle) => ({ handle })),
  };
}

function setup() {
  const loser: MergeRecord = {
    handle: 1,
    automaticCcPersons: collection([100, 101]),
  };
  const winner: MergeRecord = {
    handle: 2,
    automaticCcPersons: collection([101, 102]),
  };
  const person: MergeRecord = { handle: 100, company: { handle: 1 } };
  const event: MergeRecord = {
    handle: 200,
    creatorCompany: { handle: 1 },
    assigneeCompany: { handle: 1 },
  };
  const companyMeta = {
    class: CompanyItem,
    props: [
      {
        name: 'automaticCcPersons',
        kind: 'm:n',
        owner: true,
        targetMeta: { class: PersonItem },
      },
    ],
    properties: {},
    uniques: [],
  } as unknown as EntityMetadata;
  const personMeta = {
    class: PersonItem,
    props: [{ name: 'company', kind: 'm:1', targetMeta: companyMeta }],
    properties: { company: { targetMeta: companyMeta } },
    uniques: [],
  } as unknown as EntityMetadata;
  const eventMeta = {
    class: EventItem,
    props: ['creatorCompany', 'assigneeCompany'].map((name) => ({
      name,
      kind: 'm:1',
      targetMeta: companyMeta,
    })),
    properties: {
      creatorCompany: { targetMeta: companyMeta },
      assigneeCompany: { targetMeta: companyMeta },
    },
    uniques: [],
  } as unknown as EntityMetadata;
  const metadata = new Map<unknown, EntityMetadata>([
    [CompanyItem, companyMeta],
    [PersonItem, personMeta],
    [EventItem, eventMeta],
  ]);
  const records = new Map<unknown, MergeRecord[]>([
    [CompanyItem, [winner]],
    [PersonItem, [person]],
    [EventItem, [event]],
  ]);
  const em = {
    getMetadata: () => ({ getAll: () => metadata }),
    find: jest.fn((entity: unknown) =>
      Promise.resolve(records.get(entity) ?? []),
    ),
    findOne: jest.fn((entity: unknown) =>
      Promise.resolve(records.get(entity)?.[0] ?? null),
    ),
    count: jest.fn(() => Promise.resolve(0)),
  };
  const mutations = { update: jest.fn(() => Promise.resolve({})) };
  const access = { assertRelationAccess: jest.fn(() => Promise.resolve()) };
  const system = {
    transfer: jest.fn(() => Promise.resolve()),
    assertNoReferences: jest.fn(() => Promise.resolve()),
  };
  const validation = {
    validateReferenceDependencies: jest.fn(() => Promise.resolve()),
  };
  const service = new GenericMergeReferencesService(
    em as unknown as EntityManager,
    {
      getEntityTemplate: () => [
        Object.assign(new EntityTemplateDto(), { name: 'company' }),
      ],
    } as unknown as TemplateService,
    access as unknown as GenericMergeAccessService,
    mutations as unknown as GenericEntityMutationService,
    system as unknown as GenericMergeSystemReferencesService,
    validation as unknown as GenericReferenceService,
  );
  const user = { handle: 1000 } as PersonItem;
  return {
    service,
    loser,
    winner,
    user,
    metadata,
    records,
    companyMeta,
    personMeta,
    eventMeta,
    em,
    mutations,
    access,
    system,
    validation,
  };
}

describe('generic merge reference graph', () => {
  it('enumerates the MikroORM metadata Map and transfers owning fields even without inverse UI fields', async () => {
    const { service, loser, winner, user, mutations, system, validation } =
      setup();
    const changed = await service.transfer(
      'company',
      loser,
      winner,
      user,
      {},
      [],
    );
    expect(mutations.update.mock.calls).toHaveLength(3);
    expect(mutations.update).toHaveBeenCalledWith(
      'company',
      2,
      { automaticCcPersons: [101, 102, 100] },
      user,
      [],
      {},
      {},
      expect.objectContaining({ deferReferenceValidation: true }),
    );
    expect(mutations.update).toHaveBeenCalledWith(
      'person',
      100,
      { company: 2 },
      user,
      [],
      {},
      {},
      expect.anything(),
    );
    expect(mutations.update).toHaveBeenCalledWith(
      'event',
      200,
      { creatorCompany: 2, assigneeCompany: 2 },
      user,
      [],
      {},
      {},
      expect.anything(),
    );
    expect(system.transfer).toHaveBeenCalledWith(
      'company',
      loser,
      winner,
      expect.any(Function),
    );
    expect(validation.validateReferenceDependencies).not.toHaveBeenCalled();
    await service.validate(changed, user);
    expect(validation.validateReferenceDependencies).toHaveBeenCalledTimes(3);
  });

  it('deduplicates incoming many-to-many links and handles a shared winner link', async () => {
    const { service, loser, winner, user, personMeta, records, mutations } =
      setup();
    personMeta.props = [
      {
        name: 'companies',
        kind: 'm:n',
        owner: true,
        targetMeta: { class: CompanyItem },
      },
    ] as unknown as EntityMetadata['props'];
    records.set(PersonItem, [
      { handle: 100, companies: collection([1, 2, 3]) },
    ]);
    await service.transfer('company', loser, winner, user, {}, []);
    expect(mutations.update).toHaveBeenCalledWith(
      'person',
      100,
      { companies: [2, 3] },
      user,
      [],
      {},
      {},
      expect.anything(),
    );
  });

  it('normalizes self relations without leaving a reference to the loser', async () => {
    const { service, loser, winner, user, companyMeta, records, mutations } =
      setup();
    companyMeta.props = [
      { name: 'parent', kind: 'm:1', targetMeta: companyMeta },
    ] as EntityMetadata['props'];
    records.set(CompanyItem, [
      { handle: 1, parent: { handle: 1 } },
      { handle: 2, parent: { handle: 1 } },
    ]);
    await service.transfer('company', loser, winner, user, {}, []);
    expect(mutations.update).toHaveBeenCalledWith(
      'company',
      2,
      { parent: 2 },
      user,
      [],
      {},
      {},
      expect.anything(),
    );
    expect(
      mutations.update.mock.calls.some((call) => (call as unknown[])[1] === 1),
    ).toBe(false);
  });

  it('aborts on a unique child relationship collision instead of deleting a child', async () => {
    const { service, loser, winner, user, personMeta, em, system } = setup();
    personMeta.props[0].unique = true;
    em.count.mockResolvedValue(1);
    await expect(
      service.transfer('company', loser, winner, user, {}, []),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(system.transfer).not.toHaveBeenCalled();
  });

  it('does not proceed when relation authorization fails', async () => {
    const { service, loser, winner, user, access, mutations } = setup();
    access.assertRelationAccess.mockRejectedValue(new Error('denied'));
    await expect(
      service.transfer('company', loser, winner, user, {}, []),
    ).rejects.toThrow('denied');
    expect(mutations.update).not.toHaveBeenCalled();
  });

  it('checks for remaining references immediately before deletion', async () => {
    const { service, loser, em } = setup();
    em.count.mockResolvedValue(1);
    await expect(
      service.assertNoReferences('company', loser),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
