import { GenericDeleteService } from './generic-delete.service';

describe('GenericDeleteService', () => {
  function createHarness(
    options: {
      children?: Array<{ handle: number }>;
    } = {},
  ) {
    class CompanyEntity {}
    class PersonEntity {}
    class HiddenChildEntity {}
    class EventEntity {}

    const findOne = jest.fn(async () => ({ handle: 4 }));
    const find = jest.fn(async () => options.children ?? []);
    const transactional = jest.fn(async (operation: () => Promise<void>) =>
      operation(),
    );
    const em = { findOne, find, transactional };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'hiddenChild') {
          return [
            {
              name: 'company',
              isReference: true,
              kind: 'm:1',
              deleteRule: 'cascade',
            },
          ];
        }
        if (entityHandle !== 'company') return [];
        return [
          {
            name: 'persons',
            isReference: true,
            kind: '1:m',
            referenceName: 'person',
            mappedBy: 'company',
            options: [],
          },
          {
            name: 'participants',
            isReference: true,
            kind: 'm:n',
            referenceName: 'person',
            mappedBy: 'companies',
            options: [],
          },
          {
            name: 'assignedEvents',
            isReference: true,
            kind: '1:m',
            referenceName: 'event',
            mappedBy: 'assigneePerson',
            options: [],
          },
          {
            name: 'hiddenChildren',
            isReference: true,
            kind: '1:m',
            referenceName: 'hiddenChild',
            mappedBy: 'company',
            options: ['isHideAsReference'],
          },
        ];
      }),
    };
    const genericQueryService = {
      getEntityClass: jest.fn((entityHandle: string) => {
        if (entityHandle === 'company') return CompanyEntity;
        if (entityHandle === 'person') return PersonEntity;
        if (entityHandle === 'hiddenChild') return HiddenChildEntity;
        return EventEntity;
      }),
    };
    const genericPermissionService = {
      applyEntityVisibilityFilter: jest.fn((filter: object) => filter),
      checkTopLevelPermission: jest.fn(),
    };
    const genericReferenceService = {
      getHandleFilter: jest.fn(
        (_entityHandle: string, handle: string | number) => ({
          handle,
        }),
      ),
      normalizeHandleValue: jest.fn(
        (_entityHandle: string, handle: string | number) =>
          typeof handle === 'string' && /^\d+$/.test(handle)
            ? Number(handle)
            : handle,
      ),
    };
    const genericEntityMutationService = {
      delete: jest.fn(async () => undefined),
      update: jest.fn(async () => ({})),
      schedulePostCommitTasks: jest.fn(),
    };
    const service = new GenericDeleteService(
      em as never,
      templateService as never,
      genericQueryService as never,
      genericPermissionService as never,
      genericReferenceService as never,
      genericEntityMutationService as never,
    );

    return {
      em,
      genericEntityMutationService,
      genericPermissionService,
      service,
    };
  }

  it('offers optional visible children and discloses hidden database cascades', async () => {
    const harness = createHarness();

    await expect(
      harness.service.getImpact('company', '4', { handle: 1 } as never),
    ).resolves.toEqual({
      action: 'delete',
      references: [
        {
          name: 'persons',
          entityHandle: 'person',
          kind: '1:m',
          required: false,
        },
        {
          name: 'assignedEvents',
          entityHandle: 'event',
          kind: '1:m',
          required: false,
        },
        {
          name: 'hiddenChildren',
          entityHandle: 'hiddenChild',
          kind: '1:m',
          required: true,
        },
      ],
    });
    expect(
      harness.genericPermissionService.checkTopLevelPermission,
    ).toHaveBeenCalledWith(
      'company',
      { handle: 4 },
      expect.objectContaining({ handle: 1 }),
      'allowDeleteStage',
    );
  });

  it('physically deletes Events through the normal delete lifecycle', async () => {
    const harness = createHarness();

    await expect(
      harness.service.delete('event', 22, { handle: 1 } as never, {}),
    ).resolves.toEqual({ action: 'deleted' });
    expect(harness.genericEntityMutationService.delete).toHaveBeenCalledWith(
      'event',
      22,
      expect.objectContaining({ handle: 1 }),
      {},
    );
    expect(harness.genericEntityMutationService.update).not.toHaveBeenCalled();
  });

  it('physically deletes an Event without provider references or delivery history', async () => {
    const harness = createHarness();

    await expect(
      harness.service.delete('event', 23, { handle: 1 } as never, {}),
    ).resolves.toEqual({ action: 'deleted' });
    expect(harness.genericEntityMutationService.delete).toHaveBeenCalledWith(
      'event',
      23,
      expect.objectContaining({ handle: 1 }),
      {},
    );
    expect(harness.genericEntityMutationService.update).not.toHaveBeenCalled();
  });

  it('deletes selected child records before the parent in one transaction', async () => {
    const harness = createHarness({ children: [{ handle: 8 }, { handle: 7 }] });

    await expect(
      harness.service.delete('company', '4', { handle: 1 } as never, {}, [
        'persons',
      ]),
    ).resolves.toEqual({ action: 'deleted' });

    expect(harness.em.transactional).toHaveBeenCalledTimes(1);
    expect(harness.em.find).toHaveBeenCalledWith(expect.any(Function), {
      company: 4,
    });
    const deleteCalls = harness.genericEntityMutationService.delete.mock
      .calls as unknown[][];
    expect(deleteCalls.map((call) => [call[0], call[1]])).toEqual([
      ['person', 7],
      ['person', 8],
      ['company', '4'],
    ]);
    expect(
      harness.genericEntityMutationService.schedulePostCommitTasks,
    ).toHaveBeenCalledTimes(1);
  });

  it('allows selected Event children to run their physical delete lifecycle', async () => {
    const harness = createHarness({ children: [{ handle: 14 }] });

    await expect(
      harness.service.delete('company', 4, { handle: 1 } as never, {}, [
        'assignedEvents',
      ]),
    ).resolves.toEqual({ action: 'deleted' });

    expect(harness.genericEntityMutationService.delete).toHaveBeenNthCalledWith(
      1,
      'event',
      14,
      expect.objectContaining({ handle: 1 }),
      expect.objectContaining({ postCommitTasks: expect.any(Array) }),
      expect.objectContaining({ postCommitTasks: expect.any(Array) }),
    );
  });
});
