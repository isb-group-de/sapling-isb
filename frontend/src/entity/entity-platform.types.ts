import type { PersonItem } from './entity-account.types'
import type { SaplingGenericItem } from './entity-base.types'
import type { TranslationItem } from './entity-integration.types'

/**
 * Represents a dashboard entity.
 */
export interface DashboardItem extends SaplingGenericItem {
  /** Unique identifier for the dashboard */
  handle: number | null
  /** Name of the dashboard */
  name: string
  /** User-defined position in the dashboard tab strip */
  sortOrder?: number | null
  /** User-defined order of assigned KPI handles */
  kpiOrder?: number[] | null
  /** The person this dashboard belongs to */
  person: PersonItem | number | null
  /** KPIs associated with this dashboard */
  kpis?: KPIItem[]
  /** Date and time when the dashboard was created */
  createdAt: Date | null
  /** Date and time when the dashboard was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a reusable dashboard template.
 */
export interface DashboardTemplateItem extends SaplingGenericItem {
  /** Unique identifier for the template */
  handle: number | null
  /** Name of the template */
  name: string
  /** Optional description */
  description?: string | null
  /** Whether the template is shared with all users */
  isShared: boolean
  /** The person owning the template */
  person: PersonItem | number | null
  /** KPIs associated with this template */
  kpis?: KPIItem[]
  /** Date and time when the template was created */
  createdAt: Date | null
  /** Date and time when the template was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a group of entities.
 */
export interface EntityGroupItem extends SaplingGenericItem {
  /** Unique identifier for the group */
  handle: string
  /** Icon for the group */
  icon: string | null
  /** Whether the group is expanded */
  isExpanded: boolean
  /** Sort order for navigation rendering */
  sortOrder?: number | null
  /** Optional parent group */
  parent?: EntityGroupItem | string | null
  /** Child groups */
  children?: EntityGroupItem[]
  /** List of entities in the group */
  entities?: EntityItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a generic entity definition.
 */
export interface EntityItem extends SaplingGenericItem {
  /** Unique identifier for the entity */
  handle: string
  /** Icon for the entity */
  icon: string | null
  /** Sort order for navigation rendering */
  order?: number | null
  /** Whether the entity is readable */
  canRead: boolean | null
  /** Permission to insert records */
  canInsert?: boolean | null
  /** Permission to update records */
  canUpdate?: boolean | null
  /** Permission to delete records */
  canDelete?: boolean | null
  /** Permission to show records */
  canShow?: boolean | null
  /** Associated group */
  group?: EntityGroupItem | string | null
  /** List of KPIs associated with the entity */
  kpis?: KPIItem[]
  /** List of favorites referencing this entity */
  favorites?: FavoriteItem[]
  /** Route paths for the entity */
  routes?: EntityRouteItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a route for an entity.
 */
export interface EntityRouteItem extends SaplingGenericItem {
  /** Unique identifier for the route */
  handle?: number | null
  /** Route path for the entity */
  route: string | null
  /** Optional navigation name for the route */
  navigation: string | null
  /** The entity associated with this route */
  entity?: EntityItem
  /** Optional navigation group override for this route */
  group?: EntityGroupItem | string | null
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a configurable script button bound to an entity.
 */
export interface ScriptButtonItem extends SaplingGenericItem {
  /** Unique identifier for the script button */
  handle?: number | null
  /** Technical action name used for backend dispatch */
  name: string
  /** Visible title rendered in the UI */
  title: string
  /** Optional parameter payload sent to the backend */
  parameter?: Record<string, unknown> | null
  /** Whether the button should operate on selected rows */
  isMultiSelect: boolean
  /** The entity to which the button belongs */
  entity: EntityItem | string
  /** Creation date */
  createdAt?: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents a favorite item for a person and entity.
 */
export interface FavoriteItem extends SaplingGenericItem {
  /** Unique identifier for the favorite item */
  handle: number
  /** Title of the favorite item */
  title: string
  /** Reference to the person */
  person: PersonItem | number | null
  /** Reference to the entity */
  entity: EntityItem | string | null
  /** Optional configured route for opening the favorite */
  entityRoute?: EntityRouteItem | number | null
  /** Optional persisted free-text search */
  search?: string | null
  /** Optional persisted sorting configuration */
  sortBy?: Array<{ key: string; order?: 'asc' | 'desc' }> | null
  /** Optional filter */
  filter?: Record<string, unknown> | string | null
  /** Date and time when the favorite was created */
  createdAt: Date | null
  /** Date and time when the favorite was last updated */
  updatedAt?: Date | null
}

/**
 * Represents a reusable worklist template for favorites.
 */
export interface FavoriteTemplateItem extends SaplingGenericItem {
  /** Unique identifier for the template */
  handle: number | null
  /** Visible template name */
  name: string
  /** Target page/entity */
  entity: EntityItem | string | null
  /** Optional configured route for opening the template */
  entityRoute?: EntityRouteItem | number | null
  /** Optional persisted filter */
  filter?: Record<string, unknown> | string | null
  /** Whether the template should be highlighted */
  isRecommended: boolean
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

export interface KPIAggregationItem extends SaplingGenericItem {
  /** Unique identifier for the aggregation type */
  handle: string
  /** List of KPIs using this aggregation type */
  kpis?: KPIItem[]
}

/**
 * Represents a KPI (Key Performance Indicator) entity.
 */
export interface KPIItem extends SaplingGenericItem {
  /** Unique identifier for the KPI (primary key) */
  handle: number
  /** Name of the KPI */
  name: string
  /** Description of the KPI (optional) */
  description?: string
  /** Aggregation type (relation to KPIAggregationItem) */
  aggregation: KPIAggregationItem
  /** Field to aggregate (e.g., "status", "priority", "product") */
  field: string
  /** Type of KPI (relation to KPITypeItem) */
  type: KPITypeItem | string
  /** Field to use for date comparison (optional) */
  timeframeField?: string | null
  /** Timeframe type (relation to KPITimeframeItem, optional) */
  timeframe?: KPITimeframeItem | null
  /** Timeframe interval (relation to KPITimeframeItem, optional) */
  timeframeInterval?: KPITimeframeItem | null
  /** Optional filter for the KPI (JSON object) */
  filter?: object
  /** Optional group by fields for the KPI (array of strings) */
  groupBy?: string[]
  /** Optional relations to include (array of strings) */
  relations?: string[]
  /** The entity this KPI targets (optional) */
  targetEntity?: EntityItem | string | null
  /** Dashboards this KPI is associated with */
  dashboards?: DashboardItem[] | number[]
  /** Dashboard templates this KPI is associated with */
  dashboardTemplates?: DashboardTemplateItem[] | number[]
  /** Date and time when the KPI was created */
  createdAt: Date | null
  /** Date and time when the KPI was last updated */
  updatedAt?: Date | null
}

export interface KPITimeframeItem extends SaplingGenericItem {
  /** Unique identifier for the timeframe type */
  handle: string
  /** List of KPIs using this timeframe */
  kpis?: KPIItem[]
  /** List of KPIs using this as interval */
  kpisInterval?: KPIItem[]
}

export interface KPITypeItem extends SaplingGenericItem {
  /** Unique identifier for the KPI type */
  handle: string
  /** List of KPIs using this type */
  kpis?: KPIItem[]
}

/**
 * Represents a language entity.
 */
export interface LanguageItem extends SaplingGenericItem {
  /** Unique identifier for the language */
  handle: string
  /** Name of the language */
  name: string
  /** List of translations associated with this language */
  translations?: TranslationItem[]
  /** List of persons associated with this language */
  persons?: PersonItem[]
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}

/**
 * Represents an information entity attached to a record.
 */
export interface InformationItem extends SaplingGenericItem {
  /** Unique identifier for the information record */
  handle: number | null
  /** Parent record handle stored as string reference */
  reference: string
  /** Long text content */
  content: string
  /** Associated parent entity */
  entity: EntityItem | string
  /** Person who last stored the information */
  person: PersonItem | number | null
  /** Creation date */
  createdAt: Date | null
  /** Last update date */
  updatedAt?: Date | null
}
