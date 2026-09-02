import 'dotenv/config';

/**
 * @constant {string[]} SAPLING_WHITELISTED_IPS
 * List of IP addresses allowed to access Sapling. Defaults to localhost addresses if not set.
 */
export const SAPLING_WHITELISTED_IPS: string[] = process.env
  .SAPLING_WHITELISTED_IPS
  ? process.env.SAPLING_WHITELISTED_IPS.split(',')
  : ['127.0.0.1', '::1'];

/**
 * @constant {boolean} REDIS_ENABLED
 * Indicates if Redis is enabled for queue management. Defaults to false.
 */
export const REDIS_ENABLED: boolean = process.env.REDIS_ENABLED === 'true';

/**
 * @constant {string} REDIS_SERVER
 * Redis server hostname. Defaults to 'localhost'.
 */
export const REDIS_SERVER: string = process.env.REDIS_SERVER || 'localhost';

/**
 * @constant {string} REDIS_USERNAME
 * Redis server username. Defaults to empty string.
 */
export const REDIS_USERNAME: string = process.env.REDIS_USERNAME || '';

/**
 * @constant {string} REDIS_PASSWORD
 * Redis server password. Defaults to empty string.
 */
export const REDIS_PASSWORD: string = process.env.REDIS_PASSWORD || '';

/**
 * @constant {number} REDIS_PORT
 * Redis server port. Defaults to 6379.
 */
export const REDIS_PORT: number = parseInt(
  process.env.REDIS_PORT || '6379',
  10,
);

/**
 * @constant {number} REDIS_ATTEMPTS
 * Number of Redis connection attempts. Defaults to 20.
 */
export const REDIS_ATTEMPTS: number = parseInt(
  process.env.REDIS_ATTEMPTS || '20',
  10,
);

/**
 * @constant {number} REDIS_REMOVE_ON_FAIL
 * Number of failed jobs to remove from Redis. Defaults to 100.
 */
export const REDIS_REMOVE_ON_FAIL: number = parseInt(
  process.env.REDIS_REMOVE_ON_FAIL || '100',
  10,
);

/**
 * @constant {string} REDIS_BACKOFF_STRATEGY
 * Redis backoff strategy for retries. Defaults to 'exponential'.
 */
export const REDIS_BACKOFF_STRATEGY: string =
  process.env.REDIS_BACKOFF_STRATEGY || 'exponential';

/**
 * @constant {number} REDIS_BACKOFF_DELAY
 * Delay in ms for Redis backoff strategy. Defaults to 1000.
 */
export const REDIS_BACKOFF_DELAY: number = parseInt(
  process.env.REDIS_BACKOFF_DELAY || '1000',
  10,
);

/**
 * @constant {boolean} REDIS_REMOVE_ON_COMPLETE
 * Indicates if completed jobs should be removed from Redis. Defaults to false.
 */
export const REDIS_REMOVE_ON_COMPLETE: boolean =
  process.env.REDIS_REMOVE_ON_COMPLETE === 'true';

/**
 * @constant {number} CALENDAR_SYNC_SCHEDULER_INTERVAL_MS
 * Interval for the calendar sync scheduler job. Defaults to 5 minutes.
 */
export const CALENDAR_SYNC_SCHEDULER_INTERVAL_MS: number = parseInt(
  process.env.CALENDAR_SYNC_SCHEDULER_INTERVAL_MS || '300000',
  10,
);

/**
 * @constant {string} GOOGLE_CLIENT_ID
 * Google OAuth client ID. Defaults to empty string.
 */
export const GOOGLE_CLIENT_ID: string = process.env.GOOGLE_CLIENT_ID || '';

/**
 * @constant {string} GOOGLE_CLIENT_SECRET
 * Google OAuth client secret. Defaults to empty string.
 */
export const GOOGLE_CLIENT_SECRET: string =
  process.env.GOOGLE_CLIENT_SECRET || '';

/**
 * @constant {string} GOOGLE_CALLBACK_URL
 * Google OAuth callback URL. Defaults to empty string.
 */
export const GOOGLE_CALLBACK_URL: string =
  process.env.GOOGLE_CALLBACK_URL || '';

/**
 * @constant {string[]} GOOGLE_SCOPE
 * Google OAuth scopes. Defaults to empty array.
 */
export const GOOGLE_SCOPE: string[] = process.env.GOOGLE_SCOPE
  ? process.env.GOOGLE_SCOPE.split(',')
  : [];

/**
 * @constant {number} WEBHOOK_TIMEOUT
 * Timeout in ms for webhook requests. Defaults to 5000.
 */
export const WEBHOOK_TIMEOUT: number = parseInt(
  process.env.WEBHOOK_TIMEOUT || '5000',
  10,
);

/**
 * @constant {number} WEBHOOK_MAX_REDIRECTS
 * Maximum number of redirects for webhook requests. Defaults to 5.
 */
export const WEBHOOK_MAX_REDIRECTS: number = parseInt(
  process.env.WEBHOOK_MAX_REDIRECTS || '5',
  10,
);

/**
 * @constant {string} AZURE_AD_TENNANT_ID
 * Azure AD tenant ID. Defaults to empty string.
 */
export const AZURE_AD_TENNANT_ID: string =
  process.env.AZURE_AD_TENNANT_ID || '';

/**
 * @constant {string} AZURE_AD_CLIENT_ID
 * Azure AD client ID. Defaults to empty string.
 */
export const AZURE_AD_CLIENT_ID: string = process.env.AZURE_AD_CLIENT_ID || '';

/**
 * @constant {string} AZURE_AD_CLIENT_SECRET
 * Azure AD client secret. Defaults to empty string.
 */
export const AZURE_AD_CLIENT_SECRET: string =
  process.env.AZURE_AD_CLIENT_SECRET || '';

/**
 * @constant {string} AZURE_AD_RESPONSE_TYPE
 * Azure AD OAuth response type. Defaults to 'code'.
 */
export const AZURE_AD_RESPONSE_TYPE: string =
  (process.env.AZURE_AD_RESPONSE_TYPE as
    'code' | 'code id_token' | 'id_token code' | 'id_token') || 'code';

/**
 * @constant {string} AZURE_AD_RESPONSE_MODE
 * Azure AD OAuth response mode. Defaults to 'form_post'.
 */
export const AZURE_AD_RESPONSE_MODE: string =
  (process.env.AZURE_AD_RESPONSE_MODE as 'form_post' | 'query') || 'form_post';

/**
 * @constant {string} AZURE_AD_REDIRECT_URL
 * Azure AD OAuth redirect URL. Defaults to empty string.
 */
export const AZURE_AD_REDIRECT_URL: string =
  process.env.AZURE_AD_REDIRECT_URL || '';

/**
 * @constant {boolean} AZURE_AD_ALLOW_HTTP
 * Allows HTTP for Azure AD OAuth. Defaults to false.
 */
export const AZURE_AD_ALLOW_HTTP: boolean =
  process.env.AZURE_AD_ALLOW_HTTP === 'true';

/**
 * @constant {string[]} AZURE_AD_SCOPE
 * Azure AD OAuth scopes. Defaults to empty array.
 */
export const AZURE_AD_SCOPE: string[] = process.env.AZURE_AD_SCOPE
  ? process.env.AZURE_AD_SCOPE.split(',')
  : [];

/**
 * @constant {string} DB_DRIVER
 * Database driver type. Defaults to 'postgresql'.
 */
export const DB_DRIVER: string = process.env.DB_DRIVER || 'postgresql';

/**
 * @constant {string} DB_NAME
 * Database name. Defaults to 'sapling'.
 */
export const DB_NAME: string = process.env.DB_NAME || 'sapling';

/**
 * @constant {string} DB_DATA_SEEDER
 * Database seeder type. Defaults to 'demonstration'.
 */
export const DB_DATA_SEEDER: string =
  process.env.DB_DATA_SEEDER || 'demonstration';

/**
 * @constant {boolean} DB_LOGGING
 * Enables database logging. Defaults to false.
 */
export const DB_LOGGING: boolean = process.env.DB_LOGGING === 'true';

export const DB_POOL_MIN: number = parseInt(process.env.DB_POOL_MIN || '2', 10);

export const DB_POOL_MAX: number = parseInt(
  process.env.DB_POOL_MAX || '10',
  10,
);

export const SECURITY_PRINCIPAL_CACHE_TTL_MS: number = Math.max(
  100,
  parseInt(process.env.SECURITY_PRINCIPAL_CACHE_TTL_MS || '2000', 10),
);

export const SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES: number = Math.max(
  0,
  parseInt(process.env.SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES || '10000', 10),
);

export const GLOBAL_SEARCH_INDEX_ENABLED: boolean =
  process.env.GLOBAL_SEARCH_INDEX_ENABLED === 'true';

/**
 * @constant {string} DB_HOST
 * Database host. Defaults to empty string.
 */
export const DB_HOST: string = process.env.DB_HOST || '';

/**
 * @constant {number} DB_PORT
 * Database port. Defaults to 3306.
 */
export const DB_PORT: number = parseInt(process.env.DB_PORT || '3306', 10);

/**
 * @constant {string} DB_USER
 * Database username. Defaults to empty string.
 */
export const DB_USER: string = process.env.DB_USER || '';

/**
 * @constant {string} DB_PASSWORD
 * Database password. Defaults to empty string.
 */
export const DB_PASSWORD: string = process.env.DB_PASSWORD || '';

/**
 * @constant {string} SAPLING_SECRET
 * Secret key for Sapling application. Defaults to null.
 */
export const SAPLING_SECRET: string | null = process.env.SAPLING_SECRET || null;

/**
 * @constant {string} SAPLING_FRONTEND_URL
 * URL for Sapling frontend application. Defaults to empty string.
 */
export const SAPLING_FRONTEND_URL: string =
  process.env.SAPLING_FRONTEND_URL || '';

/**
 * @constant {string} API_REQUEST_BODY_LIMIT
 * Maximum JSON and URL-encoded request body size parsed by Express.
 */
export const API_REQUEST_BODY_LIMIT: string =
  process.env.API_REQUEST_BODY_LIMIT || '2mb';

/**
 * @constant {string} SAPLING_DEFAULT_PHONE_COUNTRY
 * ISO 3166-1 alpha-2 country used for local phone number normalization.
 */
export const SAPLING_DEFAULT_PHONE_COUNTRY: string =
  process.env.SAPLING_DEFAULT_PHONE_COUNTRY || 'DE';

/**
 * @constant {string} SAPLING_DEFAULT_PHONE_DIALING_CODE
 * International dialing code used for local phone number normalization.
 */
export const SAPLING_DEFAULT_PHONE_DIALING_CODE: string =
  process.env.SAPLING_DEFAULT_PHONE_DIALING_CODE || '49';

const sessionCookieSameSite =
  process.env.SESSION_COOKIE_SAME_SITE?.trim().toLowerCase();

/**
 * Resolves the session cookie Secure flag.
 *
 * An explicit true/false value takes precedence over NODE_ENV so local release
 * builds can use HTTP. Missing or invalid values retain the secure production
 * default.
 */
export function resolveSessionCookieSecure(
  configuredValue: string | undefined,
  nodeEnvironment: string | undefined,
): boolean {
  const normalizedValue = configuredValue?.trim().toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }
  if (normalizedValue === 'false') {
    return false;
  }

  return nodeEnvironment === 'production';
}

/**
 * @constant {string} SESSION_COOKIE_NAME
 * Cookie name used for session authentication.
 */
export const SESSION_COOKIE_NAME: string =
  process.env.SESSION_COOKIE_NAME || 'sapling.sid';

/**
 * @constant {number} SESSION_MAX_AGE
 * Max age for authenticated sessions in milliseconds.
 */
export const SESSION_MAX_AGE: number = parseInt(
  process.env.SESSION_MAX_AGE || '86400000',
  10,
);

/**
 * @constant {number} SESSION_REMEMBER_ME_MAX_AGE
 * Max age for remembered authenticated sessions in milliseconds.
 */
export const SESSION_REMEMBER_ME_MAX_AGE: number = parseInt(
  process.env.SESSION_REMEMBER_ME_MAX_AGE || '2592000000',
  10,
);

/**
 * @constant {number} GENERIC_DOWNLOAD_LIMIT
 * Maximum number of rows returned by generic JSON exports.
 */
export const GENERIC_DOWNLOAD_LIMIT: number = parseInt(
  process.env.GENERIC_DOWNLOAD_LIMIT || '5000',
  10,
);

/**
 * @constant {number} GENERIC_LIST_DEFAULT_LIMIT
 * Default page size for public generic entity list queries.
 */
export const GENERIC_LIST_DEFAULT_LIMIT = 100;

/**
 * @constant {number} GENERIC_LIST_MAX_LIMIT
 * Maximum page size for public generic entity list queries.
 */
export const GENERIC_LIST_MAX_LIMIT = 100;

/**
 * @constant {boolean} SESSION_COOKIE_SECURE
 * Enables the Secure cookie flag for sessions. Explicit true/false values take
 * precedence; otherwise it defaults to true in production.
 */
export const SESSION_COOKIE_SECURE: boolean = resolveSessionCookieSecure(
  process.env.SESSION_COOKIE_SECURE,
  process.env.NODE_ENV,
);

/**
 * @constant {false | 'lax' | 'strict' | 'none'} SESSION_COOKIE_SAME_SITE
 * SameSite policy for the session cookie. Defaults to lax.
 */
export const SESSION_COOKIE_SAME_SITE: false | 'lax' | 'strict' | 'none' =
  sessionCookieSameSite === 'strict' ||
  sessionCookieSameSite === 'lax' ||
  sessionCookieSameSite === 'none'
    ? sessionCookieSameSite
    : sessionCookieSameSite === 'false'
      ? false
      : 'lax';

/**
 * @constant {number} SESSION_TRUST_PROXY
 * Number of trusted reverse proxies for secure cookie handling.
 */
export const SESSION_TRUST_PROXY: number = (() => {
  const raw = process.env.SESSION_TRUST_PROXY?.trim();

  if (!raw || raw === 'false') {
    return 0;
  }

  if (raw === 'true') {
    return 1;
  }

  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
})();

/**
 * @constant {string} SAPLING_HASH_INDICATOR
 * Hash indicator for password hashing. Defaults to '$2b$'.
 */
export const SAPLING_HASH_INDICATOR: string =
  process.env.SAPLING_HASH_INDICATOR || '$2b$';

/**
 * @constant {number} SAPLING_HASH_COST
 * Cost factor for password hashing. Defaults to 10.
 */
export const SAPLING_HASH_COST: number = parseInt(
  process.env.SAPLING_HASH_COST || '10',
  10,
);

/**
 * @constant {string} LOG_OUTPUT_PATH
 * Path for log output files. Defaults to '../log'.
 */
export const LOG_OUTPUT_PATH: string = process.env.LOG_OUTPUT_PATH || '../log';

/**
 * @constant {number} LOG_BACKUP_FILES
 * Number of backup log files to keep. Defaults to 14.
 */
export const LOG_BACKUP_FILES: number = parseInt(
  process.env.LOG_BACKUP_FILES || '14',
  10,
);

/**
 * @constant {string} LOG_LEVEL
 * Logging level. Defaults to 'info'.
 */
export const LOG_LEVEL: string = process.env.LOG_LEVEL || 'info';

/**
 * @constant {string} LOG_NAME_REQUESTS
 * Log file name for requests. Defaults to 'request.log'.
 */
export const LOG_NAME_REQUESTS: string =
  process.env.LOG_NAME_REQUESTS || 'request.log';

/**
 * @constant {string} LOG_NAME_SERVER
 * Log file name for server logs. Defaults to 'server.log'.
 */
export const LOG_NAME_SERVER: string =
  process.env.LOG_NAME_SERVER || 'server.log';

/**
 * @constant {boolean} LOG_REQUESTS_CONSOLE_ENABLED
 * Whether Morgan writes HTTP request logs to the console. Defaults to true.
 */
export const LOG_REQUESTS_CONSOLE_ENABLED: boolean =
  process.env.LOG_REQUESTS_CONSOLE_ENABLED?.trim().toLowerCase() !== 'false';

/**
 * @constant {boolean} LOG_REQUESTS_FILE_ENABLED
 * Whether Morgan writes HTTP request logs to the rotating request log file.
 * Defaults to true.
 */
export const LOG_REQUESTS_FILE_ENABLED: boolean =
  process.env.LOG_REQUESTS_FILE_ENABLED?.trim().toLowerCase() !== 'false';

/** Enables the persistent server-side monitoring collector. */
export const SYSTEM_TELEMETRY_ENABLED: boolean =
  process.env.SYSTEM_TELEMETRY_ENABLED?.trim().toLowerCase() !== 'false';

/** Stable instance identifier used to separate measurements from backend nodes. */
export const SYSTEM_TELEMETRY_INSTANCE_ID: string =
  process.env.SYSTEM_TELEMETRY_INSTANCE_ID?.trim() ||
  process.env.INSTANCE_ID?.trim() ||
  '';

/** Stable installation/environment id. Configure this explicitly in production. */
export const SYSTEM_TELEMETRY_ENVIRONMENT_ID: string =
  process.env.SYSTEM_TELEMETRY_ENVIRONMENT_ID?.trim() || '';

/** Stable logical backend process slot. */
export const SYSTEM_TELEMETRY_PROCESS_SLOT: string =
  process.env.SYSTEM_TELEMETRY_PROCESS_SLOT?.trim() ||
  SYSTEM_TELEMETRY_INSTANCE_ID ||
  `backend:${process.env.NODE_APP_INSTANCE || '0'}`;

/** Enables non-destructive synthetic system checks. */
export const SYSTEM_MONITORING_CHECKS_ENABLED: boolean =
  process.env.SYSTEM_MONITORING_CHECKS_ENABLED?.trim().toLowerCase() !==
  'false';

/** Fast infrastructure sampling interval. Values below five seconds are rejected. */
export const SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS: number = Math.max(
  5000,
  parseInt(process.env.SYSTEM_TELEMETRY_SAMPLE_INTERVAL_MS || '10000', 10),
);

/** Maximum local telemetry fallback spool size. */
export const SYSTEM_TELEMETRY_SPOOL_MAX_MB: number = Math.max(
  10,
  parseInt(process.env.SYSTEM_TELEMETRY_SPOOL_MAX_MB || '100', 10),
);

/**
 * @constant {string[]} LOG_APPENDERS
 * List of log appenders. Defaults to ['console', 'file'].
 */
export const LOG_APPENDERS: string[] = process.env.LOG_APPENDERS
  ? process.env.LOG_APPENDERS.split(',')
  : ['console', 'file'];

/**
 * @constant {number} PORT
 * Application port. Defaults to 3000.
 */
export const PORT: number = parseInt(process.env.PORT || '3000', 10);

export * from './ai-api.constants';
