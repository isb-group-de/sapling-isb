import { BadGatewayException } from '@nestjs/common';
import { AuthProviderDirectoryService } from './auth-provider-directory.service';
import type { PersonSessionItem } from '../entity/PersonSessionItem';
import type { ProviderUserListResponseDto } from './dto/provider-user.dto';

type TestableDirectoryService = {
  listAzureUsers(
    accessToken: string,
    options: { search?: string; pageToken?: string },
  ): Promise<ProviderUserListResponseDto>;
  listAzureUsersWithRetry(
    session: PersonSessionItem,
    options: { search?: string; pageToken?: string },
  ): Promise<ProviderUserListResponseDto>;
  waitForProviderRetry(delayMs: number): Promise<void>;
};

function asTestable(
  service: AuthProviderDirectoryService,
): TestableDirectoryService {
  return service as unknown as TestableDirectoryService;
}

describe('AuthProviderDirectoryService', () => {
  it('retries transient Azure directory failures', async () => {
    const testService = asTestable(new AuthProviderDirectoryService());
    const transientError = Object.assign(new Error('fetch failed'), {
      code: 'TypeError',
    });
    const listAzureUsers = jest
      .spyOn(testService, 'listAzureUsers')
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({ users: [], nextPageToken: null });
    jest
      .spyOn(testService, 'waitForProviderRetry')
      .mockResolvedValue(undefined);

    const result = await testService.listAzureUsersWithRetry(
      { accessToken: 'token' } as PersonSessionItem,
      {},
    );

    expect(result).toEqual({ users: [], nextPageToken: null });
    expect(listAzureUsers).toHaveBeenCalledTimes(2);
  });

  it('returns a translated provider error after repeated Azure failures', async () => {
    const testService = asTestable(new AuthProviderDirectoryService());
    const transientError = Object.assign(new Error('fetch failed'), {
      code: 'TypeError',
    });
    jest.spyOn(testService, 'listAzureUsers').mockRejectedValue(transientError);
    jest
      .spyOn(testService, 'waitForProviderRetry')
      .mockResolvedValue(undefined);

    await expect(
      testService.listAzureUsersWithRetry(
        { accessToken: 'token' } as PersonSessionItem,
        {},
      ),
    ).rejects.toMatchObject({
      message: 'providerUserImport.azureDirectoryUnavailable',
    });
    await expect(
      testService.listAzureUsersWithRetry(
        { accessToken: 'token' } as PersonSessionItem,
        {},
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
