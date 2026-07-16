import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import axios from 'axios';
import { admin_directory_v1, google } from 'googleapis';
import {
  AZURE_AD_CLIENT_ID,
  AZURE_AD_CLIENT_SECRET,
  AZURE_AD_SCOPE,
  AZURE_AD_TENNANT_ID,
  GOOGLE_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from '../constants/project.constants';
import { PersonSessionItem } from '../entity/PersonSessionItem';
import type {
  ProviderUserDto,
  ProviderUserListResponseDto,
  ProviderUserProvider,
} from './dto/provider-user.dto';
import {
  type AzureGraphUser,
  type GoogleDirectoryUser,
  isAuthenticationProviderError,
  isTransientProviderError,
  mapAzureUserToProviderUser,
  mapGoogleUserToProviderUser,
  providerUserMatchesSearch,
} from './auth-provider-directory.utils';

type AzureGraphUsersResponse = {
  value?: AzureGraphUser[];
  '@odata.nextLink'?: string;
};

type GoogleDirectoryUsersResponse = {
  users?: GoogleDirectoryUser[];
  nextPageToken?: string | null;
};

type DirectoryListOptions = { search?: string; pageToken?: string };

const PROVIDER_DIRECTORY_RETRY_ATTEMPTS = 2;
const PROVIDER_DIRECTORY_RETRY_DELAY_MS = 350;
const PROVIDER_DIRECTORY_PAGE_SIZE = 50;
const PROVIDER_DIRECTORY_SEARCH_SCAN_LIMIT = 500;

@Injectable()
export class AuthProviderDirectoryService {
  async listUsers(
    provider: ProviderUserProvider,
    session: PersonSessionItem,
    options: DirectoryListOptions,
  ): Promise<ProviderUserListResponseDto> {
    return provider === 'azure'
      ? this.listAzureUsersWithRetry(session, options)
      : this.listGoogleUsersWithRetry(session, options);
  }

  async getUser(
    provider: ProviderUserProvider,
    session: PersonSessionItem,
    userId: string,
  ): Promise<ProviderUserDto> {
    return provider === 'azure'
      ? this.getAzureUserWithRetry(session, userId)
      : this.getGoogleUserWithRetry(session, userId);
  }

  private createAzureClient(accessToken: string): Client {
    return Client.init({ authProvider: (done) => done(null, accessToken) });
  }

  private async listAzureUsersWithRetry(
    session: PersonSessionItem,
    options: DirectoryListOptions,
  ): Promise<ProviderUserListResponseDto> {
    const accessToken = await this.resolveAzureAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('providerUserImport.azureTokenNotFound');
    }

    try {
      return await this.executeProviderDirectoryRequest('azure', () =>
        this.listAzureUsers(accessToken, options),
      );
    } catch (error) {
      if (!isAuthenticationProviderError(error)) throw error;
      const refreshedToken = await this.refreshAzureAccessToken(session);
      if (!refreshedToken) throw error;
      return this.executeProviderDirectoryRequest('azure', () =>
        this.listAzureUsers(refreshedToken, options),
      );
    }
  }

  private async listAzureUsers(
    accessToken: string,
    options: DirectoryListOptions,
  ): Promise<ProviderUserListResponseDto> {
    const client = this.createAzureClient(accessToken);
    if (options.search?.trim()) {
      return this.listAzureUsersByLocalSearch(client, options);
    }

    const response = await this.fetchAzureUsersPage(client, options.pageToken);
    return {
      users: (response.value ?? []).map(mapAzureUserToProviderUser),
      nextPageToken: response['@odata.nextLink'] ?? null,
    };
  }

  private async listAzureUsersByLocalSearch(
    client: Client,
    options: DirectoryListOptions,
  ): Promise<ProviderUserListResponseDto> {
    const matches: ProviderUserDto[] = [];
    let scanned = 0;
    let nextPageToken: string | null = options.pageToken ?? null;

    do {
      const response = await this.fetchAzureUsersPage(client, nextPageToken);
      const pageUsers = response.value ?? [];
      scanned += pageUsers.length;
      matches.push(
        ...pageUsers
          .map(mapAzureUserToProviderUser)
          .filter((user) => providerUserMatchesSearch(user, options.search)),
      );
      nextPageToken = response['@odata.nextLink'] ?? null;
    } while (
      nextPageToken &&
      matches.length < PROVIDER_DIRECTORY_PAGE_SIZE &&
      scanned < PROVIDER_DIRECTORY_SEARCH_SCAN_LIMIT
    );

    return {
      users: matches.slice(0, PROVIDER_DIRECTORY_PAGE_SIZE),
      nextPageToken,
    };
  }

  private async fetchAzureUsersPage(
    client: Client,
    pageToken?: string | null,
  ): Promise<AzureGraphUsersResponse> {
    let request = client.api(pageToken || '/users');
    if (!pageToken) {
      request = request
        .select(
          'id,displayName,givenName,surname,mail,userPrincipalName,accountEnabled',
        )
        .top(PROVIDER_DIRECTORY_PAGE_SIZE);
    }
    return (await request.get()) as AzureGraphUsersResponse;
  }

  private async getAzureUserWithRetry(
    session: PersonSessionItem,
    userId: string,
  ): Promise<ProviderUserDto> {
    const accessToken = await this.resolveAzureAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('providerUserImport.azureTokenNotFound');
    }

    try {
      return await this.executeProviderDirectoryRequest('azure', () =>
        this.getAzureUser(accessToken, userId),
      );
    } catch (error) {
      if (!isAuthenticationProviderError(error)) throw error;
      const refreshedToken = await this.refreshAzureAccessToken(session);
      if (!refreshedToken) throw error;
      return this.executeProviderDirectoryRequest('azure', () =>
        this.getAzureUser(refreshedToken, userId),
      );
    }
  }

  private async getAzureUser(
    accessToken: string,
    userId: string,
  ): Promise<ProviderUserDto> {
    const user = (await this.createAzureClient(accessToken)
      .api(`/users/${encodeURIComponent(userId)}`)
      .select('id,displayName,givenName,surname,mail,userPrincipalName')
      .get()) as AzureGraphUser;
    return mapAzureUserToProviderUser(user);
  }

  private async listGoogleUsersWithRetry(
    session: PersonSessionItem,
    options: DirectoryListOptions,
  ): Promise<ProviderUserListResponseDto> {
    const accessToken = await this.resolveGoogleAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('providerUserImport.googleTokenNotFound');
    }

    try {
      return await this.executeProviderDirectoryRequest('google', () =>
        this.listGoogleUsers(accessToken, options),
      );
    } catch (error) {
      if (!isAuthenticationProviderError(error)) throw error;
      const refreshedToken = await this.refreshGoogleAccessToken(session);
      if (!refreshedToken) throw error;
      return this.executeProviderDirectoryRequest('google', () =>
        this.listGoogleUsers(refreshedToken, options),
      );
    }
  }

  private async listGoogleUsers(
    accessToken: string,
    options: DirectoryListOptions,
  ): Promise<ProviderUserListResponseDto> {
    const directory = google.admin({ version: 'directory_v1' });
    if (options.search?.trim()) {
      return this.listGoogleUsersByLocalSearch(directory, accessToken, options);
    }

    const response = await this.fetchGoogleUsersPage(
      directory,
      accessToken,
      options.pageToken,
    );
    return {
      users: (response.users ?? []).map(mapGoogleUserToProviderUser),
      nextPageToken: response.nextPageToken ?? null,
    };
  }

  private async listGoogleUsersByLocalSearch(
    directory: admin_directory_v1.Admin,
    accessToken: string,
    options: DirectoryListOptions,
  ): Promise<ProviderUserListResponseDto> {
    const matches: ProviderUserDto[] = [];
    let scanned = 0;
    let nextPageToken: string | null = options.pageToken ?? null;

    do {
      const response = await this.fetchGoogleUsersPage(
        directory,
        accessToken,
        nextPageToken,
      );
      const pageUsers = response.users ?? [];
      scanned += pageUsers.length;
      matches.push(
        ...pageUsers
          .map(mapGoogleUserToProviderUser)
          .filter((user) => providerUserMatchesSearch(user, options.search)),
      );
      nextPageToken = response.nextPageToken ?? null;
    } while (
      nextPageToken &&
      matches.length < PROVIDER_DIRECTORY_PAGE_SIZE &&
      scanned < PROVIDER_DIRECTORY_SEARCH_SCAN_LIMIT
    );

    return {
      users: matches.slice(0, PROVIDER_DIRECTORY_PAGE_SIZE),
      nextPageToken,
    };
  }

  private async fetchGoogleUsersPage(
    directory: admin_directory_v1.Admin,
    accessToken: string,
    pageToken?: string | null,
  ): Promise<GoogleDirectoryUsersResponse> {
    const response = (await directory.users.list({
      auth: accessToken,
      customer: 'my_customer',
      maxResults: PROVIDER_DIRECTORY_PAGE_SIZE,
      orderBy: 'email',
      pageToken: pageToken || undefined,
    })) as { data: GoogleDirectoryUsersResponse };
    return response.data;
  }

  private async getGoogleUserWithRetry(
    session: PersonSessionItem,
    userId: string,
  ): Promise<ProviderUserDto> {
    const accessToken = await this.resolveGoogleAccessToken(session);
    if (!accessToken) {
      throw new UnauthorizedException('providerUserImport.googleTokenNotFound');
    }

    try {
      return await this.executeProviderDirectoryRequest('google', () =>
        this.getGoogleUser(accessToken, userId),
      );
    } catch (error) {
      if (!isAuthenticationProviderError(error)) throw error;
      const refreshedToken = await this.refreshGoogleAccessToken(session);
      if (!refreshedToken) throw error;
      return this.executeProviderDirectoryRequest('google', () =>
        this.getGoogleUser(refreshedToken, userId),
      );
    }
  }

  private async getGoogleUser(
    accessToken: string,
    userId: string,
  ): Promise<ProviderUserDto> {
    const response = (await google
      .admin({ version: 'directory_v1' })
      .users.get({ auth: accessToken, userKey: userId })) as {
      data: GoogleDirectoryUser;
    };
    return mapGoogleUserToProviderUser(response.data);
  }

  private async refreshAzureAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    const refreshToken = session.refreshToken?.trim();
    if (!refreshToken) return null;

    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENNANT_ID || 'common'}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: AZURE_AD_CLIENT_ID,
      client_secret: AZURE_AD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (AZURE_AD_SCOPE.length > 0)
      params.set('scope', AZURE_AD_SCOPE.join(' '));

    const response = await axios.post<{ access_token?: string }>(
      tokenEndpoint,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const accessToken = response.data.access_token?.trim() ?? null;
    if (accessToken) session.accessToken = accessToken;
    return accessToken;
  }

  private async resolveAzureAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    return session.accessToken?.trim() || this.refreshAzureAccessToken(session);
  }

  private async refreshGoogleAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    const refreshToken = session.refreshToken?.trim();
    if (!refreshToken) return null;

    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID || undefined,
      GOOGLE_CLIENT_SECRET || undefined,
      GOOGLE_CALLBACK_URL || undefined,
    );
    auth.setCredentials({ refresh_token: refreshToken });
    const refreshed = await auth.refreshAccessToken();
    const accessToken = refreshed.credentials.access_token?.trim() ?? null;
    if (accessToken) session.accessToken = accessToken;
    return accessToken;
  }

  private async resolveGoogleAccessToken(
    session: PersonSessionItem,
  ): Promise<string | null> {
    return (
      session.accessToken?.trim() || this.refreshGoogleAccessToken(session)
    );
  }

  private async executeProviderDirectoryRequest<T>(
    provider: ProviderUserProvider,
    request: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= PROVIDER_DIRECTORY_RETRY_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await request();
      } catch (error) {
        lastError = error;
        if (
          isAuthenticationProviderError(error) ||
          !isTransientProviderError(error) ||
          attempt >= PROVIDER_DIRECTORY_RETRY_ATTEMPTS
        ) {
          break;
        }
        await this.waitForProviderRetry(PROVIDER_DIRECTORY_RETRY_DELAY_MS);
      }
    }

    if (
      lastError &&
      !isAuthenticationProviderError(lastError) &&
      isTransientProviderError(lastError)
    ) {
      throw new BadGatewayException(
        provider === 'azure'
          ? 'providerUserImport.azureDirectoryUnavailable'
          : 'providerUserImport.googleDirectoryUnavailable',
      );
    }
    throw lastError;
  }

  private async waitForProviderRetry(delayMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
