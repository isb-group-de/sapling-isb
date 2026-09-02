import type { EntityItem } from '../../entity/EntityItem';
import type { EntityRouteItem } from '../../entity/EntityRouteItem';
import type { PersonItem } from '../../entity/PersonItem';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

export type SearchableEntity = EntityItem & {
  routes?: EntityRouteItem[] | { getItems?: () => EntityRouteItem[] };
};

export interface EntitySearchContext {
  entity: SearchableEntity;
  template: EntityTemplateDto[];
  fields: string[];
  valueFields: ValueField[];
  relations: string[];
  query: string;
  terms: string[];
  perEntityLimit: number;
  currentUser: PersonItem;
}

export interface ValueField {
  path: string;
  referenceRoot?: string;
}

export interface ReferenceValueField extends ValueField {
  referenceRoot: string;
  isSearchable: boolean;
}

export interface MatchPreview {
  field: string;
  value: string;
}

export type ReadableTemplateCache = Map<string, Promise<EntityTemplateDto[]>>;

export const DEFAULT_GLOBAL_SEARCH_LIMIT = 12;
export const MAX_GLOBAL_SEARCH_LIMIT = 25;
export const MIN_GLOBAL_SEARCH_QUERY_LENGTH = 2;
export const MAX_GLOBAL_SEARCH_QUERY_LENGTH = 100;
export const ENTITY_SEARCH_CONCURRENCY = 6;
