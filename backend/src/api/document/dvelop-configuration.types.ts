export type DvelopCloudRecord = Record<string, unknown>;

export type DvelopRepositoryEndpoint = {
  service: 'dms' | 'dmsconfig';
  segments: string[];
  trailingSlash?: boolean;
  repositoryScoped?: boolean;
};

export type DvelopSyncSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

export interface DvelopImportedObjectDefinition {
  dvelopId?: string | null;
  title?: string | null;
  description?: string | null;
  isActive?: boolean | null;
}

export interface DvelopImportedRepository {
  dvelopId?: string | null;
  title?: string | null;
  version?: string | null;
  isDefault?: boolean | null;
  isAvailable?: boolean | null;
}

export interface DvelopImportedProperty {
  dvelopId?: string | null;
  objectDefinitionId?: string | null;
  title?: string | null;
  dataType?: string | null;
  description?: string | null;
  isRequired?: boolean | null;
  isMultiValue?: boolean | null;
  isActive?: boolean | null;
}

export interface DvelopConfigurationImportPayload {
  repositories?: DvelopImportedRepository[];
  objectDefinitions?: DvelopImportedObjectDefinition[];
  properties?: DvelopImportedProperty[];
}

export interface DvelopConfigurationSyncPayload {
  repositories?: boolean;
  objectDefinitions?: boolean;
  properties?: boolean;
}

export interface DvelopConfigurationImportResponse {
  repositories: DvelopSyncSummary;
  objectDefinitions: DvelopSyncSummary;
  properties: DvelopSyncSummary;
}

export type DvelopHealthCheckCapabilityKey =
  | 'apiKey'
  | 'repositories'
  | 'objectDefinitions'
  | 'properties';

export type DvelopHealthCheckStatus = 'success' | 'warning' | 'error';

export interface DvelopHealthCheckCapability {
  key: DvelopHealthCheckCapabilityKey;
  status: DvelopHealthCheckStatus;
  message: string;
  count?: number;
}

export interface DvelopHealthCheckResponse {
  status: DvelopHealthCheckStatus;
  checkedAt: string;
  connectionHandle: number;
  repositoryId?: string | null;
  capabilities: DvelopHealthCheckCapability[];
}
