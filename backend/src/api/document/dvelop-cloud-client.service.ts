import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import type { DvelopRepositoryEndpoint } from './dvelop-configuration.types';

const DVELOP_CONFIG_REQUEST_TIMEOUT_MS = 30_000;
const DVELOP_ACCEPT_HEADERS = [
  'application/hal+json',
  'application/json',
  '*/*',
];

export const DVELOP_REPOSITORY_ENDPOINTS: DvelopRepositoryEndpoint[] = [
  { service: 'dms', segments: ['r'], repositoryScoped: false },
];

export const DVELOP_OBJECT_DEFINITION_ENDPOINTS: DvelopRepositoryEndpoint[] = [
  { service: 'dms', segments: ['objdef'] },
  {
    service: 'dmsconfig',
    segments: ['objectmanagement', 'categories'],
    trailingSlash: true,
  },
  { service: 'dmsconfig', segments: ['objectdefinitions'] },
  { service: 'dmsconfig', segments: ['object-definitions'] },
  { service: 'dmsconfig', segments: ['categories'] },
];

export const DVELOP_GLOBAL_PROPERTY_ENDPOINTS: DvelopRepositoryEndpoint[] = [
  { service: 'dmsconfig', segments: ['properties'] },
  { service: 'dmsconfig', segments: ['propertydefinitions'] },
  { service: 'dmsconfig', segments: ['property-definitions'] },
];

@Injectable()
export class DvelopCloudClientService {
  validateConnection(connection: DvelopConnectionItem): void {
    this.buildAuthHeaders(connection);
    this.buildRepositoryUrl(connection, DVELOP_REPOSITORY_ENDPOINTS[0]);
  }

  async fetchFirstPayload(
    connection: DvelopConnectionItem,
    endpoints: DvelopRepositoryEndpoint[],
    throwOnFailure = true,
  ): Promise<unknown> {
    const authHeaders = this.buildAuthHeaders(connection);
    const urls = endpoints.map((endpoint) =>
      this.buildRepositoryUrl(connection, endpoint),
    );
    const errors: string[] = [];

    for (const url of urls) {
      let urlError: string | null = null;

      for (const acceptHeader of DVELOP_ACCEPT_HEADERS) {
        try {
          const response = await axios.get<unknown>(url, {
            headers: {
              ...authHeaders,
              Accept: acceptHeader,
            },
            timeout: DVELOP_CONFIG_REQUEST_TIMEOUT_MS,
            validateStatus: () => true,
          });

          if (response.status >= 200 && response.status < 300) {
            return response.data;
          }

          urlError = `${url}: ${response.status} ${response.statusText}`.trim();
          if (response.status !== 406) {
            break;
          }
        } catch (error) {
          urlError = `${url}: ${this.getErrorMessage(error)}`;
          break;
        }
      }

      errors.push(urlError ?? `${url}: request failed`);
    }

    if (throwOnFailure) {
      throw new BadRequestException(errors.join('\n'));
    }

    return null;
  }

  getRepositoryId(connection: DvelopConnectionItem): string | null {
    const repository = connection.repository;

    if (
      repository &&
      typeof repository === 'object' &&
      'dvelopId' in repository
    ) {
      return repository.dvelopId?.trim() || null;
    }

    return null;
  }

  getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return `${error.response.status} ${error.response.statusText}`.trim();
      }

      return error.message;
    }

    return error instanceof Error ? error.message : String(error);
  }

  private buildAuthHeaders(
    connection: DvelopConnectionItem,
  ): Record<string, string> {
    const apiKey = connection.apiKey?.trim();
    if (!apiKey) {
      throw new BadRequestException('document.dvelopApiKeyMissing');
    }

    return {
      Authorization: apiKey.toLowerCase().startsWith('bearer ')
        ? apiKey
        : `Bearer ${apiKey}`,
    };
  }

  private buildRepositoryUrl(
    connection: DvelopConnectionItem,
    endpoint: DvelopRepositoryEndpoint,
  ): string {
    let base: URL;
    try {
      base = new URL(connection.baseUrl.trim());
    } catch {
      throw new BadRequestException('document.dvelopBaseUrlInvalid');
    }

    if (!['http:', 'https:'].includes(base.protocol)) {
      throw new BadRequestException('document.dvelopBaseUrlInvalid');
    }

    const repositoryScoped = endpoint.repositoryScoped !== false;
    const repositoryId = repositoryScoped
      ? this.getRepositoryId(connection)
      : null;

    if (repositoryScoped && !repositoryId) {
      throw new BadRequestException('document.dvelopRepositoryMissing');
    }

    const path = repositoryScoped
      ? [
          endpoint.service,
          'r',
          encodeURIComponent(repositoryId ?? ''),
          ...endpoint.segments.map((segment) => encodeURIComponent(segment)),
        ].join('/')
      : [
          endpoint.service,
          ...endpoint.segments.map((segment) => encodeURIComponent(segment)),
        ].join('/');

    return new URL(
      `/${path}${endpoint.trailingSlash ? '/' : ''}`,
      base,
    ).toString();
  }
}
