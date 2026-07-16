/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

jest.mock('./current/current.service', () => ({ CurrentService: class {} }));
jest.mock('./github/github.service', () => ({ GithubService: class {} }));
jest.mock('./kpi/kpi.service', () => ({ KpiService: class {} }));
jest.mock('./kpi/dto/kpi-response.dto', () => ({ KpiResponseDto: class {} }));
jest.mock('./kpi/dto/kpi-value.dto', () => ({ KpiValueDto: class {} }));
jest.mock('./template/template.service', () => ({ TemplateService: class {} }));
jest.mock('./template/dto/entity-template.dto', () => ({
  EntityTemplateDto: class {},
}));
jest.mock('./system/services/cpu.service', () => ({ CpuService: class {} }));
jest.mock('./system/services/memory.service', () => ({
  MemoryService: class {},
}));
jest.mock('./system/services/filesystem.service', () => ({
  FilesystemService: class {},
}));
jest.mock('./system/services/network.service', () => ({
  NetworkService: class {},
}));
jest.mock('./system/services/os.service', () => ({ OsService: class {} }));
jest.mock('./system/services/time.service', () => ({ TimeService: class {} }));
jest.mock('./system/services/version.service', () => ({
  VersionService: class {},
}));
jest.mock('../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../entity/TicketItem', () => ({ TicketItem: class {} }));
jest.mock('../entity/EventItem', () => ({ EventItem: class {} }));
jest.mock('../entity/SalesOpportunityItem', () => ({
  SalesOpportunityItem: class {},
}));
jest.mock('../entity/WorkHourWeekItem', () => ({ WorkHourWeekItem: class {} }));
jest.mock('../entity/global/entity.registry', () => ({
  ENTITY_HANDLES: ['ticket'],
  ENTITY_REGISTRY: [],
}));
jest.mock('./current/dto/accumulated-permission.dto', () => ({
  AccumulatedPermissionDto: class {},
}));

import { CurrentController } from './current/current.controller';
import { GithubController } from './github/github.controller';
import { KpiController } from './kpi/kpi.controller';
import { SystemController } from './system/system.controller';
import { TemplateController } from './template/template.controller';
import { PersonItem } from '../entity/PersonItem';

const createMockUser = (): PersonItem =>
  ({
    handle: 1,
    username: 'tester',
  }) as unknown as PersonItem;

const asMock = (value: unknown): jest.Mock => value as jest.Mock;

describe('CurrentController', () => {
  it('returns the hydrated current person when available', async () => {
    const hydratedUser = {
      handle: 1,
      username: 'hydrated',
    } as unknown as PersonItem;
    const currentService = {
      getPersonWithStarterWorkspace: jest.fn(async () => hydratedUser),
    };
    const controller = new CurrentController(
      currentService as never,
      {} as never,
      {} as never,
    );
    const req = { user: createMockUser() };

    await expect(controller.getPerson(req as never)).resolves.toBe(
      hydratedUser,
    );
    expect(
      asMock(currentService.getPersonWithStarterWorkspace),
    ).toHaveBeenCalledWith(req.user);
  });

  it('falls back to the request user when no hydrated current person exists', async () => {
    const currentService = {
      getPersonWithStarterWorkspace: jest.fn(async () => null),
    };
    const controller = new CurrentController(
      currentService as never,
      {} as never,
      {} as never,
    );
    const req = { user: createMockUser() };

    await expect(controller.getPerson(req as never)).resolves.toBe(req.user);
  });

  it('changes the current user password', async () => {
    const currentService = {
      changePassword: jest.fn(async () => undefined),
    };
    const controller = new CurrentController(
      currentService as never,
      {} as never,
      {} as never,
    );
    const req = { user: createMockUser() };

    await expect(
      controller.changePassword(req as never, 'secret', 'secret'),
    ).resolves.toBeUndefined();
    expect(asMock(currentService.changePassword)).toHaveBeenCalledWith(
      req.user,
      'secret',
    );
  });

  it('rejects password changes when fields are missing', async () => {
    const controller = new CurrentController(
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.changePassword({ user: createMockUser() } as never, '', ''),
    ).rejects.toThrow(new BadRequestException('login.passwordRequired'));
  });

  it('rejects password changes when passwords do not match', async () => {
    const controller = new CurrentController(
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.changePassword({ user: createMockUser() } as never, 'a', 'b'),
    ).rejects.toThrow(new BadRequestException('login.passwordsDoNotMatch'));
  });

  it('streams open-task snapshots for the current user', async () => {
    const snapshot = {
      count: 5,
      tickets: [{ handle: 1 }],
      tasks: [{ handle: 2 }],
      salesOpportunities: [{ handle: 3 }],
      effortEstimates: [{ handle: 4 }],
      notifications: [{ handle: 5 }],
    };
    const currentService = {
      getOpenTaskSnapshot: jest.fn(async () => snapshot),
    };
    const openTaskEventsService = {
      streamForUser: jest.fn(() => of(undefined)),
    };
    const controller = new CurrentController(
      currentService as never,
      {} as never,
      openTaskEventsService as never,
    );
    const req = { user: createMockUser() };

    await expect(
      firstValueFrom(controller.streamOpenTaskCountEvents(req as never)),
    ).resolves.toEqual(
      expect.objectContaining({
        type: 'open-task-snapshot',
        retry: 5000,
        data: snapshot,
      }),
    );
    expect(asMock(openTaskEventsService.streamForUser)).toHaveBeenCalledWith(
      req.user.handle,
    );
    expect(asMock(currentService.getOpenTaskSnapshot)).toHaveBeenCalledWith(
      req.user,
    );
  });

  it('returns all entity permissions for the current user', async () => {
    const permissions = [{ entityHandle: 'ticket' }];
    const currentService = {
      getAllEntityPermissions: jest.fn(() => permissions),
    };
    const controller = new CurrentController(
      currentService as never,
      {} as never,
      {} as never,
    );
    const req = { user: createMockUser() };

    await expect(
      controller.getAllEntityPermissions(req as never),
    ).resolves.toBe(permissions);
    expect(asMock(currentService.getAllEntityPermissions)).toHaveBeenCalledWith(
      req.user,
    );
  });

  it('returns permissions for a specific entity', async () => {
    const permission = { entityHandle: 'ticket' };
    const currentService = {
      getEntityPermissions: jest.fn(() => permission),
    };
    const controller = new CurrentController(
      currentService as never,
      {} as never,
      {} as never,
    );
    const req = { user: createMockUser() };

    await expect(
      controller.getEntityPermission(req as never, 'ticket'),
    ).resolves.toBe(permission);
    expect(asMock(currentService.getEntityPermissions)).toHaveBeenCalledWith(
      req.user,
      'ticket',
    );
  });

  it('rejects entity permission lookups without an entity handle', async () => {
    const controller = new CurrentController(
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.getEntityPermission({ user: createMockUser() } as never, ''),
    ).rejects.toThrow(new BadRequestException('global.entityHandleRequired'));
  });

  it('returns the configured work week for the current user', async () => {
    const workWeek = { handle: 1 };
    const currentService = {
      getWorkWeek: jest.fn(async () => workWeek),
    };
    const controller = new CurrentController(
      currentService as never,
      {} as never,
      {} as never,
    );
    const req = { user: createMockUser() };

    await expect(controller.getWorkWeek(req as never)).resolves.toBe(workWeek);
    expect(asMock(currentService.getWorkWeek)).toHaveBeenCalledWith(req.user);
  });
});

describe('TemplateController', () => {
  it('returns entity template metadata', async () => {
    const template = [{ property: 'name' }];
    const templateService = {
      getEntityTemplate: jest.fn(() => template),
    };
    const controller = new TemplateController(templateService as never);
    const response = {
      setHeader: jest.fn(),
      status: jest.fn(),
    };

    await expect(
      controller.getEntityTemplate(
        'ticket',
        { headers: {} } as never,
        response as never,
      ),
    ).resolves.toBe(template);
    expect(asMock(templateService.getEntityTemplate)).toHaveBeenCalledWith(
      'ticket',
    );
  });
});

describe('GithubController', () => {
  it('returns repository information', async () => {
    const repository = { name: 'sapling' };
    const githubService = {
      getRepository: jest.fn(async () => repository),
      getReleases: jest.fn(),
      getIssues: jest.fn(),
      createIssue: jest.fn(),
    };
    const controller = new GithubController(githubService as never);

    await expect(controller.getRepository()).resolves.toBe(repository);
  });

  it('returns releases', async () => {
    const releases = [{ tag: 'v1.0.0' }];
    const githubService = {
      getRepository: jest.fn(),
      getReleases: jest.fn(async () => releases),
      getIssues: jest.fn(),
      createIssue: jest.fn(),
    };
    const controller = new GithubController(githubService as never);

    await expect(controller.getReleases()).resolves.toBe(releases);
  });

  it('returns issues using the default status', async () => {
    const issues = [{ handle: 1 }];
    const githubService = {
      getRepository: jest.fn(),
      getReleases: jest.fn(),
      getIssues: jest.fn(async () => issues),
      createIssue: jest.fn(),
    };
    const controller = new GithubController(githubService as never);

    await expect(controller.getIssues({} as never)).resolves.toBe(issues);
    expect(asMock(githubService.getIssues)).toHaveBeenCalledWith('open');
  });

  it('returns issues using the provided status', async () => {
    const githubService = {
      getRepository: jest.fn(),
      getReleases: jest.fn(),
      getIssues: jest.fn(async () => []),
      createIssue: jest.fn(),
    };
    const controller = new GithubController(githubService as never);

    await controller.getIssues({ status: 'closed' } as never);

    expect(asMock(githubService.getIssues)).toHaveBeenCalledWith('closed');
  });

  it('creates a GitHub issue', async () => {
    const issue = { id: 7, title: 'Issue' };
    const githubService = {
      getRepository: jest.fn(),
      getReleases: jest.fn(),
      getIssues: jest.fn(),
      createIssue: jest.fn(async () => issue),
    };
    const controller = new GithubController(githubService as never);
    const payload = {
      title: 'Export bricht bei leerem Filter ab',
      description: 'Beim Export ohne Filter erscheint ein 500-Fehler.',
      type: 'bug',
    };

    await expect(controller.createIssue(payload as never)).resolves.toBe(issue);
    expect(asMock(githubService.createIssue)).toHaveBeenCalledWith(payload);
  });
});

describe('KpiController', () => {
  it('executes a KPI by handle', async () => {
    const result = { value: 42 };
    const kpiService = {
      executeKPIById: jest.fn(async () => result),
      executeKPIBatch: jest.fn(),
    };
    const controller = new KpiController(kpiService as never);

    await expect(
      controller.executeKPI(7, { user: createMockUser() } as never),
    ).resolves.toBe(result);
    expect(asMock(kpiService.executeKPIById)).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ handle: 1 }),
    );
  });

  it('executes KPI handles as a batch', async () => {
    const result = [{ value: 42 }, { value: 7 }];
    const kpiService = {
      executeKPIById: jest.fn(),
      executeKPIBatch: jest.fn(async () => result),
    };
    const controller = new KpiController(kpiService as never);

    await expect(
      controller.executeKPIBatch({ handles: [7, 8] }, {
        user: createMockUser(),
      } as never),
    ).resolves.toEqual({ items: result });
    expect(asMock(kpiService.executeKPIBatch)).toHaveBeenCalledWith(
      [7, 8],
      expect.objectContaining({ handle: 1 }),
    );
  });
});

describe('SystemController', () => {
  const cpuService = {
    getCpu: jest.fn(async () => ({ manufacturer: 'Test CPU' })),
    getCpuSpeed: jest.fn(async () => ({ avg: 3.2 })),
  };
  const memoryService = {
    getMemory: jest.fn(async () => ({ total: 1024 })),
  };
  const filesystemService = {
    getFilesystem: jest.fn(async () => [{ fs: '/' }]),
  };
  const networkService = {
    getNetwork: jest.fn(async () => [{ iface: 'lo' }]),
  };
  const osService = {
    getOs: jest.fn(async () => ({ platform: 'linux' })),
  };
  const timeService = {
    getTime: jest.fn(() => ({ current: 1 })),
  };
  const versionService = {
    getVersion: jest.fn(() => ({ version: '0.0.1' })),
  };

  const controller = new SystemController(
    cpuService as never,
    memoryService as never,
    filesystemService as never,
    networkService as never,
    osService as never,
    timeService as never,
    versionService,
  );

  it('returns CPU information', async () => {
    await expect(controller.getCpu()).resolves.toEqual({
      manufacturer: 'Test CPU',
    });
  });

  it('returns CPU speed information', async () => {
    await expect(controller.getCpuSpeed()).resolves.toEqual({ avg: 3.2 });
  });

  it('returns memory information', async () => {
    await expect(controller.getMemory()).resolves.toEqual({ total: 1024 });
  });

  it('returns filesystem information', async () => {
    await expect(controller.getFilesystem()).resolves.toEqual([{ fs: '/' }]);
  });

  it('returns network information', async () => {
    await expect(controller.getNetwork()).resolves.toEqual([{ iface: 'lo' }]);
  });

  it('returns operating system information', async () => {
    await expect(controller.getOs()).resolves.toEqual({ platform: 'linux' });
  });

  it('returns time information', () => {
    expect(controller.getTime()).toEqual({ current: 1 });
  });

  it('returns application version information', () => {
    expect(controller.getVersion()).toEqual({ version: '0.0.1' });
  });

  it('returns the current application state', () => {
    global.isReady = true;

    expect(controller.getState()).toEqual({ isReady: true });

    global.isReady = false;
  });
});
