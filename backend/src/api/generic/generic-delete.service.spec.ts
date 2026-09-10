import { GenericDeleteService } from './generic-delete.service';

describe('GenericDeleteService', () => {
  function createHarness(
    options: {
      children?: Array<{ handle: number }>;
      item?: { handle: number } | null;
    } = {},
  ) {
    class CompanyEntity {}
    class PersonEntity {}
    class HiddenChildEntity {}
    class EventEntity {}
    class TicketEntity {}
    class TicketTimeTrackingEntity {}
    class EffortEstimateEntity {}
    class ProjectEntity {}
    class TaskEntity {}

    const findOne = jest.fn(async () =>
      options.item === undefined ? { handle: 4 } : options.item,
    );
    const find = jest.fn(async () => options.children ?? []);
    const transactional = jest.fn(async (operation: () => Promise<void>) =>
      operation(),
    );
    const em = { findOne, find, transactional };
    const templateService = {
      getEntityTemplate: jest.fn((entityHandle: string) => {
        if (entityHandle === 'ticketTimeTracking') {
          return [
            {
              name: 'ticket',
              isReference: true,
              kind: 'm:1',
              deleteRule: 'cascade',
            },
          ];
        }
        if (entityHandle === 'event' || entityHandle === 'effortEstimate') {
          return [
            {
              name: 'ticket',
              isReference: true,
              kind: 'm:1',
              deleteRule: 'set null',
            },
          ];
        }
        if (entityHandle === 'ticket') {
          return [
            {
              name: 'timeTrackings',
              isReference: true,
              kind: '1:m',
              referenceName: 'ticketTimeTracking',
              mappedBy: 'ticket',
              options: [],
            },
            {
              name: 'events',
              isReference: true,
              kind: '1:m',
              referenceName: 'event',
              mappedBy: 'ticket',
              options: [],
            },
            {
              name: 'effortEstimates',
              isReference: true,
              kind: '1:m',
              referenceName: 'effortEstimate',
              mappedBy: 'ticket',
              options: [],
            },
          ];
        }
        if (entityHandle === 'project') {
          return [
            {
              name: 'tasks',
              isReference: true,
              kind: '1:m',
              referenceName: 'task',
              mappedBy: 'project',
              options: [],
            },
          ];
        }
        if (entityHandle === 'task') {
          return [
            {
              name: 'project',
              isReference: true,
              kind: 'm:1',
              nullable: false,
              deleteRule: null,
            },
          ];
        }
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
        if (entityHandle === 'ticket') return TicketEntity;
        if (entityHandle === 'ticketTimeTracking')
          return TicketTimeTrackingEntity;
        if (entityHandle === 'effortEstimate') return EffortEstimateEntity;
        if (entityHandle === 'project') return ProjectEntity;
        if (entityHandle === 'task') return TaskEntity;
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

  it('derives mandatory and optional Ticket children from owning delete rules', async () => {
    const harness = createHarness();

    await expect(
      harness.service.getImpact('ticket', '4', { handle: 1 } as never),
    ).resolves.toEqual({
      action: 'delete',
      references: [
        {
          name: 'timeTrackings',
          entityHandle: 'ticketTimeTracking',
          kind: '1:m',
          required: true,
        },
        {
          name: 'events',
          entityHandle: 'event',
          kind: '1:m',
          required: false,
        },
        {
          name: 'effortEstimates',
          entityHandle: 'effortEstimate',
          kind: '1:m',
          required: false,
        },
      ],
    });
  });

  it('requires and recursively deletes non-nullable children without a database cascade', async () => {
    const harness = createHarness({ children: [{ handle: 9 }] });

    await expect(
      harness.service.getImpact('project', 4, { handle: 1 } as never),
    ).resolves.toEqual({
      action: 'delete',
      references: [
        {
          name: 'tasks',
          entityHandle: 'task',
          kind: '1:m',
          required: true,
        },
      ],
    });

    await expect(
      harness.service.delete('project', 4, { handle: 1 } as never, {}),
    ).resolves.toEqual({ action: 'deleted' });

    expect(harness.genericEntityMutationService.delete.mock.calls).toEqual([
      [
        'task',
        9,
        expect.objectContaining({ handle: 1 }),
        expect.objectContaining({ postCommitTasks: expect.any(Array) }),
        expect.objectContaining({ postCommitTasks: expect.any(Array) }),
      ],
      [
        'project',
        4,
        expect.objectContaining({ handle: 1 }),
        expect.objectContaining({ postCommitTasks: expect.any(Array) }),
        { postCommitTasks: expect.any(Array) },
      ],
    ]);
  });

  it('treats an already missing record as deleted in the impact preview', async () => {
    const harness = createHarness({ item: null });

    await expect(
      harness.service.getImpact('company', '4', { handle: 1 } as never),
    ).resolves.toEqual({ action: 'delete', references: [] });
    expect(
      harness.genericPermissionService.checkTopLevelPermission,
    ).not.toHaveBeenCalled();
  });

  it('treats an already missing record as a successful no-op deletion', async () => {
    const harness = createHarness({ item: null });

    await expect(
      harness.service.delete('company', '4', { handle: 1 } as never, {}, [
        'persons',
      ]),
    ).resolves.toEqual({ action: 'deleted' });
    expect(harness.em.transactional).not.toHaveBeenCalled();
    expect(harness.genericEntityMutationService.delete).not.toHaveBeenCalled();
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
      { postCommitTasks: undefined },
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
      { postCommitTasks: undefined },
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

  it('keeps cascade effects in the enclosing transaction task buffer', async () => {
    const harness = createHarness({ children: [{ handle: 8 }] });
    const postCommitTasks: import('./generic-entity-mutation.service').GenericPostCommitTask[] =
      [];
    await harness.service.delete(
      'company',
      4,
      { handle: 1 } as never,
      { postCommitTasks },
      ['persons'],
    );
    expect(
      harness.genericEntityMutationService.schedulePostCommitTasks,
    ).not.toHaveBeenCalled();
    for (const call of harness.genericEntityMutationService.delete.mock
      .calls as unknown[][]) {
      expect(call[3]).toEqual({ postCommitTasks });
      expect(call[4]).toEqual({ postCommitTasks });
    }
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
      expect.objectContaining({
        postCommitTasks: expect.any(Array) as unknown,
      }),
      expect.objectContaining({
        postCommitTasks: expect.any(Array) as unknown,
      }),
    );
  });
});
