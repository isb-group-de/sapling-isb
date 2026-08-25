import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));

jest.mock('../../constants/project.constants', () => ({
  GITHUB_API_URL: 'https://api.github.test',
  GITHUB_REPO: 'owner/repo',
  GITHUB_TOKEN: 'token',
}));

import axios from 'axios';
import { GithubService } from './github.service';
import { GithubIssueStatus } from './dto/github.dto';

const mockedAxios = axios as unknown as {
  get: jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
  post: jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
};
const axiosGet = mockedAxios.get;
const axiosPost = mockedAxios.post;

describe('GithubService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads issue comments and filters pull requests from issue lists', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-29T00:00:00.000Z'));

    axiosGet
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            number: 7,
            title: 'Closed bug',
            html_url: 'https://github.test/owner/repo/issues/7',
            body: 'Fixed by configuration.',
            updated_at: '2026-06-28T11:00:00Z',
            created_at: '2026-06-27T10:00:00Z',
            closed_at: '2026-06-28T11:00:00Z',
            state: 'closed',
            comments: 1,
            labels: [{ name: 'bug', color: 'D73A4A' }],
            assignees: [],
          },
          {
            id: 3,
            number: 6,
            title: 'Old closed bug',
            html_url: 'https://github.test/owner/repo/issues/6',
            body: 'Closed months ago.',
            updated_at: '2026-06-28T13:00:00Z',
            created_at: '2026-04-27T10:00:00Z',
            closed_at: '2026-05-01T11:00:00Z',
            state: 'closed',
            comments: 1,
            labels: [{ name: 'bug', color: 'D73A4A' }],
            assignees: [],
          },
          {
            id: 2,
            number: 8,
            title: 'Pull request',
            html_url: 'https://github.test/owner/repo/pull/8',
            body: '',
            updated_at: '2026-06-28T12:00:00Z',
            created_at: '2026-06-27T12:00:00Z',
            closed_at: '2026-06-28T12:00:00Z',
            state: 'closed',
            comments: 0,
            labels: [],
            assignees: [],
            pull_request: {},
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 17,
            html_url: 'https://github.test/owner/repo/issues/7#issuecomment-17',
            body: 'Solution was deployed.',
            created_at: '2026-06-28T12:30:00Z',
            updated_at: '2026-06-28T12:35:00Z',
            user: {
              login: 'maintainer',
              avatar_url: 'https://github.test/avatar.png',
              html_url: 'https://github.test/maintainer',
            },
          },
        ],
      });

    const service = new GithubService();

    await expect(service.getIssues(GithubIssueStatus.CLOSED)).resolves.toEqual([
      expect.objectContaining({
        number: 7,
        comments: [
          {
            id: 17,
            html_url: 'https://github.test/owner/repo/issues/7#issuecomment-17',
            body: 'Solution was deployed.',
            created_at: '2026-06-28T12:30:00Z',
            updated_at: '2026-06-28T12:35:00Z',
            user: {
              login: 'maintainer',
              avatar_url: 'https://github.test/avatar.png',
              html_url: 'https://github.test/maintainer',
            },
          },
        ],
      }),
    ]);
    expect(axiosGet).toHaveBeenNthCalledWith(
      1,
      'https://api.github.test/repos/owner/repo/issues?state=closed&per_page=25&since=2026-05-29T00%3A00%3A00.000Z',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
    expect(axiosGet).toHaveBeenNthCalledWith(
      2,
      'https://api.github.test/repos/owner/repo/issues/7/comments?per_page=100',
      expect.any(Object),
    );
    expect(axiosGet).toHaveBeenCalledTimes(2);
  });

  it('adds the authenticated Sapling user to a created issue', async () => {
    axiosPost
      .mockResolvedValueOnce({
        data: {
          id: 7,
          number: 176,
          title: 'Support queue fails',
          html_url: 'https://github.test/owner/repo/issues/176',
          body: '',
          updated_at: '2026-08-25T10:00:00Z',
          created_at: '2026-08-25T10:00:00Z',
          closed_at: null,
          state: 'open',
          labels: [],
          assignees: [],
        },
      })
      .mockResolvedValueOnce({ data: [{ name: 'bug', color: 'D73A4A' }] });
    axiosGet.mockResolvedValueOnce({
      data: { name: 'bug', color: 'D73A4A' },
    });
    const service = new GithubService();

    await service.createIssue(
      {
        title: 'Support queue fails',
        description: 'The queue cannot be saved.',
        type: 'bug' as never,
      },
      {
        handle: 42,
        firstName: 'Ada',
        lastName: 'Lovelace',
        loginName: 'ada.lovelace',
      } as never,
    );

    expect(axiosPost).toHaveBeenNthCalledWith(
      1,
      'https://api.github.test/repos/owner/repo/issues',
      {
        title: 'Support queue fails',
        body: [
          '**Type:** Bug',
          '**Reported by:** Ada Lovelace',
          '**Login:** `ada.lovelace`',
          '',
          'The queue cannot be saved.',
        ].join('\n'),
      },
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
