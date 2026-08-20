import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class EntityManager {},
  Type: class Type {},
}));
jest.mock('../../entity/PersonItem', () => ({
  PersonItem: class PersonItem {},
}));
jest.mock('../../entity/PersonSessionItem', () => ({
  PersonSessionItem: class PersonSessionItem {},
}));
jest.mock('../../entity/SharedMailboxContextItem', () => ({
  SharedMailboxContextItem: class SharedMailboxContextItem {},
}));

const graphApiGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const graphApiSelect = jest.fn(() => ({ get: graphApiGet }));
const graphApi = jest.fn(() => ({ select: graphApiSelect }));
const graphInit = jest.fn(() => ({ api: graphApi }));

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: { init: graphInit },
}));

import { BadRequestException, Logger } from '@nestjs/common';
import { MailProviderSessionService } from './mail-provider-session.service';

type TestSession = {
  accessToken?: string;
  refreshToken: string;
};

function createPerson(
  session: TestSession,
  sharedMailboxGroups: unknown[] = [],
) {
  return {
    handle: 1,
    firstName: 'Martin',
    lastName: 'Rosbund',
    email: 'fallback@example.com',
    type: { handle: 'azure' },
    sharedMailboxGroups,
    session,
  };
}

function createService(
  person: ReturnType<typeof createPerson>,
  context: unknown = null,
) {
  const em = {
    findOne: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce(person)
      .mockResolvedValue(context),
  };
  return new MailProviderSessionService(em as never);
}

describe('MailProviderSessionService', () => {
  it('does not expose unconfigured Azure aliases and alternate mails', async () => {
    graphApiGet.mockReset();
    graphApiGet.mockResolvedValue({
      displayName: 'ISB - Martin Rosbund',
      mail: 'martin.rosbund@example.com',
      otherMails: ['service@example.com'],
      proxyAddresses: [
        'SMTP:martin.rosbund@example.com',
        'smtp:team@example.com',
      ],
    });
    const service = createService(
      createPerson({ accessToken: 'token', refreshToken: 'refresh' }),
    );

    const result = await service.listSenderOptions({ handle: 1 } as never);

    expect(result.provider).toBe('azure');
    expect(result.senders.map((sender) => sender.email)).toEqual([
      'martin.rosbund@example.com',
      'fallback@example.com',
    ]);
  });

  it('refreshes an expired Azure token before resolving senders', async () => {
    graphApiGet.mockReset();
    graphApiGet
      .mockRejectedValueOnce(
        new Error('Lifetime validation failed, the token is expired.'),
      )
      .mockResolvedValueOnce({
        displayName: 'ISB - Martin Rosbund',
        mail: 'martin.rosbund@example.com',
      });
    const session = { accessToken: 'stale-token', refreshToken: 'refresh' };
    const service = createService(createPerson(session));
    const refreshAccessToken = jest
      .spyOn(service, 'refreshAccessToken')
      .mockImplementation((_provider, currentSession) => {
        currentSession.accessToken = 'fresh-token';
        return Promise.resolve('fresh-token');
      });

    const result = await service.listSenderOptions({ handle: 1 } as never);

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(graphApiGet).toHaveBeenCalledTimes(2);
    expect(result.senders.map((sender) => sender.email)).toEqual([
      'martin.rosbund@example.com',
      'fallback@example.com',
    ]);
  });

  it('falls back when sender lookup authentication cannot recover', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    graphApiGet.mockReset();
    graphApiGet.mockRejectedValue(
      new Error('Lifetime validation failed, the token is expired.'),
    );
    const service = createService(
      createPerson({ accessToken: 'stale-token', refreshToken: 'refresh' }),
    );
    const refreshAccessToken = jest
      .spyOn(service, 'refreshAccessToken')
      .mockResolvedValue(null);

    const result = await service.listSenderOptions({ handle: 1 } as never);

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(result.senders.map((sender) => sender.email)).toEqual([
      'fallback@example.com',
    ]);
    expect(warn).toHaveBeenCalledWith(
      'Refreshing azure access token for sender lookup failed, using fallback sender options.',
    );
    warn.mockRestore();
  });

  it('includes configured shared mailboxes for the current provider', async () => {
    graphApiGet.mockReset();
    graphApiGet.mockResolvedValue({
      displayName: 'ISB - Martin Rosbund',
      mail: 'martin.rosbund@example.com',
    });
    const service = createService(
      createPerson({ accessToken: 'token', refreshToken: 'refresh' }, [
        {
          isActive: true,
          items: [
            {
              title: 'Support',
              email: 'support@example.com',
              provider: { handle: 'azure' },
              isActive: true,
            },
            {
              title: 'Legacy',
              email: 'legacy@example.com',
              provider: { handle: 'google' },
              isActive: true,
            },
          ],
        },
      ]),
    );

    const result = await service.listSenderOptions({ handle: 1 } as never);

    expect(result.senders.map((sender) => sender.email)).toContain(
      'support@example.com',
    );
    expect(result.senders.map((sender) => sender.email)).not.toContain(
      'legacy@example.com',
    );
  });

  it('preselects an assigned shared mailbox configured for the entity context', async () => {
    graphApiGet.mockReset();
    graphApiGet.mockResolvedValue({
      displayName: 'ISB - Martin Rosbund',
      mail: 'martin.rosbund@example.com',
    });
    const service = createService(
      createPerson({ accessToken: 'token', refreshToken: 'refresh' }, [
        {
          isActive: true,
          items: [
            {
              title: 'Support',
              email: 'support@example.com',
              provider: { handle: 'azure' },
              isActive: true,
            },
          ],
        },
      ]),
      {
        entity: { handle: 'ticket' },
        mailbox: { email: 'support@example.com' },
        isActive: true,
      },
    );

    const result = await service.listSenderOptions(
      { handle: 1 } as never,
      'ticket',
    );

    expect(
      result.senders.find((sender) => sender.email === 'support@example.com')
        ?.isDefault,
    ).toBe(true);
    expect(
      result.senders.find(
        (sender) => sender.email === 'martin.rosbund@example.com',
      )?.isDefault,
    ).toBe(false);
  });

  it('returns the active email template configured for the entity context', async () => {
    graphApiGet.mockReset();
    graphApiGet.mockResolvedValue({
      displayName: 'ISB - Martin Rosbund',
      mail: 'martin.rosbund@example.com',
    });
    const service = createService(
      createPerson({ accessToken: 'token', refreshToken: 'refresh' }),
      {
        entity: { handle: 'ticket' },
        mailbox: { email: 'support@example.com' },
        template: {
          handle: 42,
          isActive: true,
          entity: { handle: 'ticket' },
        },
        isActive: true,
      },
    );

    const result = await service.listSenderOptions(
      { handle: 1 } as never,
      'ticket',
    );

    expect(result.defaultTemplateHandle).toBe(42);
  });

  it('ignores a configured email template from another entity context', async () => {
    graphApiGet.mockReset();
    graphApiGet.mockResolvedValue({
      displayName: 'ISB - Martin Rosbund',
      mail: 'martin.rosbund@example.com',
    });
    const service = createService(
      createPerson({ accessToken: 'token', refreshToken: 'refresh' }),
      {
        entity: { handle: 'ticket' },
        mailbox: { email: 'support@example.com' },
        template: {
          handle: 42,
          isActive: true,
          entity: { handle: 'salesOpportunity' },
        },
        isActive: true,
      },
    );

    const result = await service.listSenderOptions(
      { handle: 1 } as never,
      'ticket',
    );

    expect(result.defaultTemplateHandle).toBeUndefined();
  });

  it('keeps the provider default when the configured mailbox is not assigned', async () => {
    graphApiGet.mockReset();
    graphApiGet.mockResolvedValue({
      displayName: 'ISB - Martin Rosbund',
      mail: 'martin.rosbund@example.com',
    });
    const service = createService(
      createPerson({ accessToken: 'token', refreshToken: 'refresh' }),
      {
        entity: { handle: 'ticket' },
        mailbox: { email: 'support@example.com' },
        isActive: true,
      },
    );

    const result = await service.listSenderOptions(
      { handle: 1 } as never,
      'ticket',
    );

    expect(
      result.senders.find(
        (sender) => sender.email === 'martin.rosbund@example.com',
      )?.isDefault,
    ).toBe(true);
    expect(
      result.senders.some((sender) => sender.email === 'support@example.com'),
    ).toBe(false);
  });

  it('rejects Azure aliases that are not configured shared mailboxes', async () => {
    graphApiGet.mockReset();
    graphApiGet.mockResolvedValue({
      displayName: 'ISB - Martin Rosbund',
      mail: 'martin.rosbund@example.com',
      otherMails: ['service@example.com'],
      proxyAddresses: ['smtp:team@example.com'],
    });
    const service = createService(
      createPerson({ accessToken: 'token', refreshToken: 'refresh' }),
    );

    await expect(
      service.resolveRequestedSender(
        { handle: 1 } as never,
        'team@example.com',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
