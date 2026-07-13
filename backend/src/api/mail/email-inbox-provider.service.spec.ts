import axios from 'axios';
import { google } from 'googleapis';
import { EmailInboxProviderService } from './email-inbox-provider.service';

jest.mock('axios');
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    gmail: jest.fn(),
  },
}));

describe('EmailInboxProviderService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads Azure inbox metadata and preserves the complete RFC 822 source', async () => {
    const mailService = {
      resolveAuthenticatedMailSession: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
      }),
    };
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          value: [
            {
              id: 'graph-message-1',
              internetMessageId: '<message@example.com>',
              conversationId: 'conversation-1',
              subject: 'New support request',
              from: {
                emailAddress: {
                  address: 'customer@example.com',
                  name: 'Customer',
                },
              },
              toRecipients: [
                { emailAddress: { address: 'support@example.com' } },
              ],
              ccRecipients: [],
              receivedDateTime: '2026-07-13T12:00:00.000Z',
              body: { contentType: 'text', content: 'Please help.' },
              internetMessageHeaders: [
                { name: 'In-Reply-To', value: '<previous@example.com>' },
              ],
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({ data: Buffer.from('raw email') } as never);

    const service = new EmailInboxProviderService(mailService as never);
    const result = await service.fetchMessages(
      {
        email: 'support@example.com',
        provider: { handle: 'azure' },
      } as never,
      { handle: 4, email: 'agent@example.com' } as never,
      new Date('2026-07-13T11:55:00.000Z'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      provider: 'azure',
      providerMessageId: 'graph-message-1',
      fromAddress: 'customer@example.com',
      bodyText: 'Please help.',
      inReplyTo: '<previous@example.com>',
    });
    expect(result[0].raw.toString('utf8')).toBe('raw email');
    expect(mockedAxios.get.mock.calls[1][0]).toContain('/$value');
  });

  it('uses the personal Azure mailbox when addresses differ only by case', async () => {
    const mailService = {
      resolveAuthenticatedMailSession: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
      }),
    };
    mockedAxios.get.mockResolvedValueOnce({ data: { value: [] } } as never);

    const service = new EmailInboxProviderService(mailService as never);
    await service.fetchMessages(
      {
        email: 'martin.rosbund@example.com',
        provider: { handle: 'azure' },
      } as never,
      { handle: 4, email: 'Martin.Rosbund@example.com' } as never,
      new Date('2026-07-13T11:55:00.000Z'),
    );

    expect(mockedAxios.get.mock.calls[0][0]).toContain(
      '/me/mailFolders/inbox/messages',
    );
  });

  it('reads Google inbox messages and preserves the complete RFC 822 source', async () => {
    const rawSource = Buffer.from('complete google RFC 822 source');
    const list = jest.fn().mockResolvedValue({
      data: { messages: [{ id: 'gmail-message-1' }] },
    });
    const get = jest.fn().mockImplementation(({ format }: { format: string }) =>
      Promise.resolve(
        format === 'raw'
          ? { data: { raw: rawSource.toString('base64url') } }
          : {
              data: {
                threadId: 'thread-1',
                internalDate: String(
                  new Date('2026-07-13T12:00:00.000Z').getTime(),
                ),
                payload: {
                  mimeType: 'multipart/alternative',
                  headers: [
                    { name: 'Message-ID', value: '<gmail@example.com>' },
                    { name: 'Subject', value: 'Google support request' },
                    {
                      name: 'From',
                      value: 'Customer <customer@example.com>',
                    },
                    { name: 'To', value: 'support@example.com' },
                  ],
                  parts: [
                    {
                      mimeType: 'text/plain',
                      body: {
                        data: Buffer.from('Please help from Google.').toString(
                          'base64url',
                        ),
                      },
                    },
                  ],
                },
              },
            },
      ),
    );
    (google.gmail as jest.Mock).mockReturnValue({
      users: { messages: { list, get } },
    });
    const mailService = {
      resolveAuthenticatedMailSession: jest.fn().mockResolvedValue({
        accessToken: 'google-access-token',
      }),
    };
    const service = new EmailInboxProviderService(mailService as never);

    const result = await service.fetchMessages(
      {
        email: 'support@example.com',
        provider: { handle: 'google' },
      } as never,
      { handle: 4, email: 'agent@example.com' } as never,
      new Date('2026-07-13T11:55:00.000Z'),
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        labelIds: ['INBOX'],
        q: `deliveredto:support@example.com after:${Math.floor(
          new Date('2026-07-13T11:55:00.000Z').getTime() / 1000,
        )}`,
      }),
    );
    expect(get).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      provider: 'google',
      providerMessageId: 'gmail-message-1',
      internetMessageId: '<gmail@example.com>',
      conversationId: 'thread-1',
      subject: 'Google support request',
      fromAddress: 'customer@example.com',
      bodyText: 'Please help from Google.',
    });
    expect(result[0].raw).toEqual(rawSource);
  });
});
