import type { SaplingGenericItem } from './entity-base.types'
import type { EntityItem, LanguageItem } from './entity-platform.types'

/**
 * Represents a translation for a property of an entity in a specific language.
 */
export interface TranslationItem extends SaplingGenericItem {
  /** Name of the entity being translated */
  entity: string
  /** Name of the property being translated */
  property: string
  /** Language of the translation */
  language: LanguageItem
  /** Translated value */
  value: string
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a webhook delivery entity.
 */
export interface WebhookDeliveryItem extends SaplingGenericItem {
  /** Unique identifier for the webhook delivery (primary key) */
  handle?: number
  /** Status of the webhook delivery */
  status?: WebhookDeliveryStatusItem
  /** The webhook subscription associated with this delivery */
  subscription: WebhookSubscriptionItem
  /** Payload of the webhook delivery */
  payload: object
  /** Optional request headers */
  requestHeaders?: object
  /** Response status code of the webhook delivery */
  responseStatusCode?: number
  /** Response body of the webhook delivery */
  responseBody?: object
  /** Optional response headers */
  responseHeaders?: object
  /** Date and time when the delivery was completed */
  completedAt?: Date | null
  /** Number of delivery attempts made */
  attemptCount: number
  /** Date and time for the next retry attempt */
  nextRetryAt?: Date | null
  /** Date and time when the delivery was created */
  createdAt?: Date | null
  /** Date and time when the delivery was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook delivery status entity.
 */
export interface WebhookDeliveryStatusItem extends SaplingGenericItem {
  /** Unique identifier for the webhook delivery status */
  handle: string
  /** Name/description of the webhook delivery status */
  description: string
  /** Icon representing the webhook delivery status */
  icon?: string
  /** Color associated with the webhook delivery status */
  color: string
  /** Whether deliveries with this status belong to the default open view */
  isOpen?: boolean | null
  /** Configurable display order */
  sortOrder?: number | null
  /** Webhook deliveries belonging to this status */
  deliveries?: WebhookDeliveryItem[]
  /** Date and time when the status was created */
  createdAt?: Date | null
  /** Date and time when the status was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook subscription entity.
 */
export interface WebhookSubscriptionItem extends SaplingGenericItem {
  /** Unique identifier for the webhook subscription (primary key) */
  handle?: number
  /** Description of the webhook subscription */
  description: string
  /** URL of the webhook subscription */
  url: string
  /** Optional custom headers */
  customHeaders?: object
  /** Indicates whether the webhook subscription is active */
  isActive: boolean
  /** Signing secret for the webhook subscription */
  signingSecret?: string
  /** Entity associated with this webhook subscription */
  entity: EntityItem
  /** Type of the webhook subscription */
  type: WebhookSubscriptionTypeItem
  /** Method of the webhook subscription */
  method: WebhookSubscriptionMethodItem
  /** Authentication type of the webhook subscription */
  authenticationType?: WebhookAuthenticationTypeItem
  /** OAuth2 authentication details (optional) */
  authenticationOAuth2?: WebhookAuthenticationOAuth2Item
  /** API Key authentication details (optional) */
  authenticationApiKey?: WebhookAuthenticationApiKeyItem
  /** Webhook deliveries for this subscription */
  deliveries?: WebhookDeliveryItem[]
  /** Date and time when the subscription was created */
  createdAt?: Date | null
  /** Date and time when the subscription was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook subscription type entity.
 */
export interface WebhookSubscriptionTypeItem extends SaplingGenericItem {
  /** Unique identifier for the webhook subscription type */
  handle: string
  /** Name/description of the webhook subscription type */
  description: string
  /** Icon representing the webhook subscription type */
  icon?: string
  /** Color associated with the webhook subscription type */
  color?: string
  /** Webhook subscriptions belonging to this type */
  subscriptions?: WebhookSubscriptionItem[]
  /** Date and time when the type was created */
  createdAt?: Date | null
  /** Date and time when the type was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook subscription method entity.
 */
export interface WebhookSubscriptionMethodItem extends SaplingGenericItem {
  /** Unique identifier for the webhook subscription method */
  handle: string
  /** Name/description of the webhook subscription method */
  description: string
  /** Icon representing the webhook subscription method */
  icon?: string
  /** Color associated with the webhook subscription method */
  color?: string
  /** Webhook subscriptions belonging to this method */
  subscriptions?: WebhookSubscriptionItem[]
  /** Date and time when the method was created */
  createdAt?: Date | null
  /** Date and time when the method was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook authentication type entity.
 */
export interface WebhookAuthenticationTypeItem extends SaplingGenericItem {
  /** Unique identifier for the webhook authentication type */
  handle: string
  /** Name/description of the webhook authentication type */
  description: string
  /** Icon representing the webhook authentication type */
  icon?: string
  /** Color associated with the webhook authentication type */
  color: string
  /** Webhook subscriptions belonging to this authentication type */
  subscriptions?: WebhookSubscriptionItem[]
  /** Date and time when the type was created */
  createdAt?: Date | null
  /** Date and time when the type was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook authentication OAuth2 entity.
 */
export interface WebhookAuthenticationOAuth2Item extends SaplingGenericItem {
  /** Unique identifier for the OAuth2 item (primary key) */
  handle?: number
  /** Description of the OAuth2 item */
  description: string
  /** Client ID for OAuth2 authentication */
  clientId: string
  /** Client secret for OAuth2 authentication */
  clientSecret: string
  /** Token URL for obtaining OAuth2 tokens */
  tokenUrl: string
  /** Scope for OAuth2 authentication (optional) */
  scope?: string
  /** Cached token (optional) */
  cachedToken?: string
  /** Token expiration date and time (optional) */
  tokenExpiresAt?: Date
  /** Webhook subscriptions belonging to this authentication type */
  subscriptions?: WebhookSubscriptionItem[]
  /** Date and time when the item was created */
  createdAt?: Date | null
  /** Date and time when the item was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a webhook authentication API Key entity.
 */
export interface WebhookAuthenticationApiKeyItem extends SaplingGenericItem {
  /** Unique identifier for the API Key item (primary key) */
  handle?: number
  /** Description of the API Key item */
  description: string
  /** Header name for the API Key authentication */
  headerName: string
  /** API Key value (optional) */
  apiKey?: string
  /** Webhook subscriptions belonging to this authentication type */
  subscriptions?: WebhookSubscriptionItem[]
  /** Date and time when the item was created */
  createdAt?: Date | null
  /** Date and time when the item was last updated */
  updatedAt?: Date | null
}
