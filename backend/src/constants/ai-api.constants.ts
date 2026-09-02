/** AI chat pagination and provider-history limits. */
export const AI_CHAT_MESSAGE_PAGE_SIZE: number = parseInt(
  process.env.AI_CHAT_MESSAGE_PAGE_SIZE || '100',
  10,
);

export const AI_MAX_CHAT_MESSAGE_PAGE_SIZE: number = parseInt(
  process.env.AI_MAX_CHAT_MESSAGE_PAGE_SIZE || '100',
  10,
);

export const AI_STREAM_HISTORY_MESSAGE_LIMIT: number = parseInt(
  process.env.AI_STREAM_HISTORY_MESSAGE_LIMIT || '24',
  10,
);

export const AI_CHAT_STREAM_CHECKPOINT_INTERVAL_MS: number = parseInt(
  process.env.AI_CHAT_STREAM_CHECKPOINT_INTERVAL_MS || '750',
  10,
);

export const AI_CHAT_RESPONSE_STALE_AFTER_MS: number = parseInt(
  process.env.AI_CHAT_RESPONSE_STALE_AFTER_MS || '1800000',
  10,
);

/** GitHub issue integration settings. */
export const GITHUB_REPO: string = process.env.GITHUB_REPO || '';
export const GITHUB_API_URL: string =
  process.env.GITHUB_API_URL || 'https://api.github.com';
export const GITHUB_TOKEN: string = process.env.GITHUB_TOKEN || '';

/** OpenAPI document metadata. */
export const API_TITLE: string = process.env.API_TITLE || 'Sapling API';
export const API_VERSION: string = process.env.API_VERSION || '1.0.0';
export const API_DESCRIPTION: string =
  process.env.API_DESCRIPTION ||
  'Sapling backend API for authenticated business workflows, including generic entity operations, documents, templates, messaging, webhooks, KPIs, system status, and AI-assisted features. Most endpoints require a valid session or bearer token, and selected endpoints are restricted to administrators.';
export const API_CONTACT_NAME: string =
  process.env.API_CONTACT_NAME || 'Martin Rosbund';
export const API_CONTACT_URL: string =
  process.env.API_CONTACT_URL || 'craffel.de';
export const API_CONTACT_EMAIL: string =
  process.env.API_CONTACT_EMAIL || 'martin.rosbund@gmail.com';
