import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { EntityRouteItem } from '../../entity/EntityRouteItem';
import { PersonItem } from '../../entity/PersonItem';
import { TemplateService } from '../template/template.service';
import { CurrentService } from '../current/current.service';
import { GenericService } from './generic.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import {
  GlobalSearchQueryDto,
  GlobalSearchResponseDto,
  GlobalSearchResultDto,
} from './dto/global-search.dto';

type SearchableEntity = EntityItem & {
  routes?: EntityRouteItem[] | { getItems?: () => EntityRouteItem[] };
};

interface EntitySearchContext {
  entity: SearchableEntity;
  template: EntityTemplateDto[];
  fields: string[];
  valueFields: string[];
  query: string;
  terms: string[];
  perEntityLimit: number;
  currentUser: PersonItem;
}

interface MatchPreview {
  field: string;
  value: string;
}

const DEFAULT_GLOBAL_SEARCH_LIMIT = 12;
const MAX_GLOBAL_SEARCH_LIMIT = 25;
const MIN_GLOBAL_SEARCH_QUERY_LENGTH = 2;
const MAX_GLOBAL_SEARCH_QUERY_LENGTH = 100;
const ENTITY_SEARCH_CONCURRENCY = 6;

@Injectable()
export class GlobalSearchService {
  constructor(
    private readonly em: EntityManager,
    private readonly currentService: CurrentService,
    private readonly genericService: GenericService,
    private readonly templateService: TemplateService,
  ) {}

  async search(
    currentUser: PersonItem,
    queryDto: GlobalSearchQueryDto,
  ): Promise<GlobalSearchResponseDto> {
    const query = this.normalizeQuery(queryDto.query);
    const limit = this.normalizeLimit(queryDto.limit);

    if (query.length < MIN_GLOBAL_SEARCH_QUERY_LENGTH) {
      return { query, items: [] };
    }

    const hydratedUser =
      (await this.currentService.getPerson(currentUser)) ?? currentUser;
    const requestedHandles = this.normalizeRequestedEntityHandles(
      queryDto.entityHandles,
    );
    const entities = await this.getSearchableEntities(
      hydratedUser,
      requestedHandles,
    );
    const terms = this.getSearchTerms(query);
    const perEntityLimit = Math.max(3, Math.min(10, limit));

    const resultSets = await this.runWithConcurrency(
      entities.map(
        (entity) => async () =>
          this.searchEntitySafely({
            entity,
            query,
            terms,
            perEntityLimit,
            currentUser: hydratedUser,
          }),
      ),
      ENTITY_SEARCH_CONCURRENCY,
    );

    const items = resultSets
      .flat()
      .sort(
        (left, right) =>
          right.score - left.score || left.label.localeCompare(right.label),
      )
      .slice(0, limit);

    return { query, items };
  }

  private async searchEntitySafely(
    context: Omit<EntitySearchContext, 'template' | 'fields' | 'valueFields'>,
  ): Promise<GlobalSearchResultDto[]> {
    try {
      const template = this.templateService.getEntityTemplate(
        context.entity.handle,
      );
      const fields = this.getSearchableFields(template);

      if (fields.length === 0) {
        return [];
      }

      const searchContext: EntitySearchContext = {
        ...context,
        template,
        fields,
        valueFields: this.getValueFields(template),
      };
      const where = this.buildSearchWhere(searchContext);
      const orderBy = template.some((field) => field.name === 'updatedAt')
        ? { updatedAt: 'DESC' }
        : {};
      const result = await this.genericService.findAndCount(
        context.entity.handle,
        where,
        1,
        context.perEntityLimit,
        orderBy,
        context.currentUser,
        [],
      );

      return result.data
        .map((record) =>
          this.toResult(searchContext, record as Record<string, unknown>),
        )
        .filter((item): item is GlobalSearchResultDto => item !== null);
    } catch (error) {
      global.log?.warn?.(
        `global search skipped entity ${context.entity.handle}:`,
        error,
      );
      return [];
    }
  }

  private async getSearchableEntities(
    currentUser: PersonItem,
    requestedHandles: string[],
  ): Promise<SearchableEntity[]> {
    const permissions =
      this.currentService.getAllEntityPermissions(currentUser);
    const readableHandles = new Set(
      permissions
        .filter((permission) => permission.allowRead && permission.allowShow)
        .map((permission) => permission.entityHandle)
        .filter((handle): handle is string => typeof handle === 'string'),
    );
    const requestedHandleSet =
      requestedHandles.length > 0 ? new Set(requestedHandles) : null;
    const handles = [...readableHandles].filter(
      (handle) => !requestedHandleSet || requestedHandleSet.has(handle),
    );

    if (handles.length === 0) {
      return [];
    }

    const entities = (await this.em.find(
      EntityItem,
      {
        handle: { $in: handles },
        canShow: true,
      },
      {
        populate: ['routes'],
        orderBy: { order: 'ASC', handle: 'ASC' },
      },
    )) as SearchableEntity[];

    return entities.filter((entity) => entity.canRead !== false);
  }

  private buildSearchWhere(context: EntitySearchContext): object {
    const fullQueryOr = this.buildFieldLikeConditions(
      context.fields,
      context.query,
    );
    const clauses: object[] = [{ $or: fullQueryOr }];

    if (context.terms.length > 1) {
      clauses.push({
        $and: context.terms.map((term) => ({
          $or: this.buildFieldLikeConditions(context.fields, term),
        })),
      });
    }

    const handleField = context.template.find(
      (field) => field.name === 'handle',
    );
    if (
      handleField &&
      this.isExactHandleCandidate(handleField, context.query)
    ) {
      clauses.push({
        handle: this.normalizeHandleQuery(handleField, context.query),
      });
    }

    return clauses.length === 1 ? clauses[0] : { $or: clauses };
  }

  private buildFieldLikeConditions(fields: string[], query: string): object[] {
    const likeValue = `%${this.stripLikeWildcards(query)}%`;
    return fields.map((field) => ({ [field]: { $ilike: likeValue } }));
  }

  private toResult(
    context: EntitySearchContext,
    record: Record<string, unknown>,
  ): GlobalSearchResultDto | null {
    const recordHandle = this.getRecordHandle(record);
    if (recordHandle == null) {
      return null;
    }

    const label =
      this.getDisplayValue(record, context.valueFields) || String(recordHandle);
    const matches = this.getMatches(record, context.fields, context.query);
    const preview =
      matches.find((match) => match.value !== label)?.value ??
      matches[0]?.value;

    return {
      entityHandle: context.entity.handle,
      recordHandle,
      label,
      preview,
      icon: context.entity.icon ?? null,
      path: this.buildRecordPath(context.entity, recordHandle),
      score: this.scoreRecord(label, matches, context.query, recordHandle),
      matches,
    };
  }

  private getSearchableFields(template: EntityTemplateDto[]): string[] {
    const preferredFields = new Set([
      'number',
      'externalNumber',
      'title',
      'name',
      'firstName',
      'lastName',
      'email',
      'subject',
      'description',
    ]);
    const candidates = template.filter((field) =>
      this.isSearchableTextField(field),
    );
    const valueFields = candidates
      .filter((field) => field.options?.includes('isValue'))
      .map((field) => field.name);
    const preferred = candidates
      .filter((field) => preferredFields.has(field.name))
      .map((field) => field.name);
    const remaining = candidates.map((field) => field.name);

    return [...new Set([...valueFields, ...preferred, ...remaining])];
  }

  private getValueFields(template: EntityTemplateDto[]): string[] {
    return template
      .filter((field) => field.options?.includes('isValue'))
      .map((field) => field.name);
  }

  private isSearchableTextField(field: EntityTemplateDto): boolean {
    return (
      field.isPersistent !== false &&
      !field.isReference &&
      !field.options?.includes('isSecurity') &&
      !field.options?.includes('isSystem') &&
      this.isStringLikeField(field)
    );
  }

  private isStringLikeField(field: EntityTemplateDto): boolean {
    const normalizedType = this.normalizeFieldType(field.type);
    if (
      [
        'string',
        'stringtype',
        'text',
        'texttype',
        'character varying',
        'varchar',
        'char',
        'uuid',
        'uuidtype',
      ].includes(normalizedType)
    ) {
      return true;
    }

    if (
      field.isReference ||
      [
        'boolean',
        'booleantype',
        'date',
        'datetype',
        'datetime',
        'time',
        'number',
        'integer',
        'integertype',
        'float',
        'double',
        'decimal',
        'decimaltype',
        'json',
        'jsontype',
      ].includes(normalizedType)
    ) {
      return false;
    }

    return typeof field.length === 'number' && field.length > 0;
  }

  private getMatches(
    record: Record<string, unknown>,
    fields: string[],
    query: string,
  ): MatchPreview[] {
    const normalizedQuery = query.toLowerCase();
    const matches: MatchPreview[] = [];

    for (const field of fields) {
      const value = this.getRecordTextValue(record, field);
      if (!value || !value.toLowerCase().includes(normalizedQuery)) {
        continue;
      }

      matches.push({
        field,
        value: this.truncatePreview(value),
      });

      if (matches.length >= 3) {
        break;
      }
    }

    return matches;
  }

  private scoreRecord(
    label: string,
    matches: MatchPreview[],
    query: string,
    recordHandle: string | number,
  ): number {
    const normalizedLabel = label.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    let score = 0;

    if (String(recordHandle).toLowerCase() === normalizedQuery) {
      score += 120;
    }

    if (normalizedLabel === normalizedQuery) {
      score += 100;
    } else if (normalizedLabel.startsWith(normalizedQuery)) {
      score += 80;
    } else if (normalizedLabel.includes(normalizedQuery)) {
      score += 60;
    }

    score += Math.max(0, 30 - matches.length * 2);
    for (const match of matches) {
      const normalizedValue = match.value.toLowerCase();
      if (normalizedValue.startsWith(normalizedQuery)) {
        score += 20;
      } else if (normalizedValue.includes(normalizedQuery)) {
        score += 10;
      }
    }

    return score;
  }

  private getDisplayValue(
    record: Record<string, unknown>,
    valueFields: string[],
  ): string {
    return valueFields
      .map((field) => this.getRecordTextValue(record, field))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private getRecordTextValue(
    record: Record<string, unknown>,
    field: string,
  ): string {
    const value = this.getNestedValue(record, field);
    if (
      value == null ||
      typeof value === 'object' ||
      typeof value === 'function'
    ) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return value.toString().trim();
    }

    return '';
  }

  private getNestedValue(
    record: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, record);
  }

  private getRecordHandle(
    record: Record<string, unknown>,
  ): string | number | null {
    const handle = record.handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }

  private buildRecordPath(
    entity: SearchableEntity,
    recordHandle: string | number,
  ): string {
    const routes = this.getRoutes(entity);
    const route =
      (entity.handle === 'event'
        ? routes.find((entry) => entry.route === 'event')
        : undefined) ??
      routes.find((entry) => entry.route?.startsWith('partner/')) ??
      routes.find((entry) => entry.route?.startsWith('table/')) ??
      routes.find((entry) => Boolean(entry.route));
    const routePath = route?.route
      ? `/${route.route.replace(/^\/+/, '')}`
      : `/table/${entity.handle}`;
    const filter = encodeURIComponent(JSON.stringify({ handle: recordHandle }));
    const open = encodeURIComponent(String(recordHandle));

    return `${routePath}?filter=${filter}&open=${open}`;
  }

  private getRoutes(entity: SearchableEntity): EntityRouteItem[] {
    const routes = entity.routes;
    if (Array.isArray(routes)) {
      return routes;
    }

    if (routes && typeof routes.getItems === 'function') {
      return routes.getItems();
    }

    return [];
  }

  private isExactHandleCandidate(
    field: EntityTemplateDto,
    query: string,
  ): boolean {
    if (!query.trim()) {
      return false;
    }

    const normalizedType = this.normalizeFieldType(field.type);
    if (['number', 'integer', 'integertype'].includes(normalizedType)) {
      return /^\d+$/.test(query);
    }

    return this.isStringLikeField(field);
  }

  private normalizeHandleQuery(
    field: EntityTemplateDto,
    query: string,
  ): string | number {
    const normalizedType = this.normalizeFieldType(field.type);
    return ['number', 'integer', 'integertype'].includes(normalizedType)
      ? Number(query)
      : query;
  }

  private normalizeQuery(query: unknown): string {
    return typeof query === 'string'
      ? query.trim().slice(0, MAX_GLOBAL_SEARCH_QUERY_LENGTH)
      : '';
  }

  private normalizeLimit(limit: unknown): number {
    const parsedLimit = Number(limit);
    if (!Number.isFinite(parsedLimit)) {
      return DEFAULT_GLOBAL_SEARCH_LIMIT;
    }

    return Math.max(
      1,
      Math.min(MAX_GLOBAL_SEARCH_LIMIT, Math.floor(parsedLimit)),
    );
  }

  private normalizeRequestedEntityHandles(entityHandles: unknown): string[] {
    if (typeof entityHandles !== 'string') {
      return [];
    }

    return [
      ...new Set(
        entityHandles
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ];
  }

  private getSearchTerms(query: string): string[] {
    return query
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= MIN_GLOBAL_SEARCH_QUERY_LENGTH);
  }

  private stripLikeWildcards(value: string): string {
    return value.replace(/[%_]/g, '').trim();
  }

  private truncatePreview(value: string): string {
    return value.length > 140 ? `${value.slice(0, 137)}...` : value;
  }

  private normalizeFieldType(type: unknown): string {
    return typeof type === 'string' ? type.toLowerCase() : '';
  }

  private async runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number,
  ): Promise<T[]> {
    const results: T[] = [];
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < tasks.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await tasks[currentIndex]();
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, tasks.length) }, () =>
        worker(),
      ),
    );

    return results;
  }
}
