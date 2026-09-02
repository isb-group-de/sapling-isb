import type { EntityManager } from '@mikro-orm/core';
import { ForbiddenException } from '@nestjs/common';
import type { PersonItem } from '../../entity/PersonItem';
import type { EntityRouteItem } from '../../entity/EntityRouteItem';
import type { TemplateService } from '../template/template.service';
import type { CurrentService } from '../current/current.service';
import type { FieldPermissionService } from '../current/field-permission.service';
import type { GenericService } from './generic.service';
import type { GlobalSearchIndexService } from './global-search-index.service';
import type {
  EntitySearchContext,
  MatchPreview,
  ReadableTemplateCache,
  ReferenceValueField,
  SearchableEntity,
  ValueField,
} from './global-search.types';
import {
  DEFAULT_GLOBAL_SEARCH_LIMIT,
  MAX_GLOBAL_SEARCH_LIMIT,
  MAX_GLOBAL_SEARCH_QUERY_LENGTH,
  MIN_GLOBAL_SEARCH_QUERY_LENGTH,
} from './global-search.types';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { GlobalSearchResultDto } from './dto/global-search.dto';

export class GlobalSearchResultOperations {
  constructor(
    protected readonly em: EntityManager,
    protected readonly currentService: CurrentService,
    protected readonly genericService: GenericService,
    protected readonly templateService: TemplateService,
    protected readonly fieldPermissions: FieldPermissionService,
    protected readonly searchIndex?: GlobalSearchIndexService,
  ) {}

  protected async getUniversallyReadableTemplate(
    currentUser: PersonItem,
    entityHandle: string,
    cache: ReadableTemplateCache,
  ): Promise<EntityTemplateDto[]> {
    const cached = cache.get(entityHandle);
    if (cached) {
      return cached;
    }

    const load = (async () => {
      const template = this.fieldPermissions
        .applyTemplateAccess(
          currentUser,
          entityHandle,
          await this.fieldPermissions.getTemplates(entityHandle),
        )
        .filter((field) => field.fieldAccess?.allowRead !== false);
      if (
        typeof this.fieldPermissions.filterUniversallyReadableFields ===
        'function'
      ) {
        return this.fieldPermissions.filterUniversallyReadableFields(
          currentUser,
          entityHandle,
          template,
        );
      }

      const readable: EntityTemplateDto[] = [];
      for (const field of template) {
        try {
          await this.fieldPermissions.assertReadableFields(
            currentUser,
            entityHandle,
            [field.name],
          );
          readable.push(field);
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      return readable;
    })().catch((error) => {
      cache.delete(entityHandle);
      throw error;
    });
    cache.set(entityHandle, load);
    return load;
  }

  protected buildSearchWhere(context: EntitySearchContext): object {
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

  protected buildFieldLikeConditions(
    fields: string[],
    query: string,
  ): object[] {
    const likeValue = `%${this.stripLikeWildcards(query)}%`;
    return fields.map((field) => ({ [field]: { $ilike: likeValue } }));
  }

  protected toResult(
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
    const labelLines = new Set(label.split('\n'));
    const preview = matches.find(
      (match) => !labelLines.has(match.value),
    )?.value;

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

  protected async getSearchConfiguration(
    currentUser: PersonItem,
    template: EntityTemplateDto[],
    readableTemplateCache: ReadableTemplateCache,
  ): Promise<{
    fields: string[];
    valueFields: ValueField[];
    relations: string[];
  }> {
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
    const scalarValueFields = template
      .filter(
        (field) => !field.isReference && field.options?.includes('isValue'),
      )
      .map((field) => ({ path: field.name }));
    const searchableScalarValueFields = candidates
      .filter((field) => field.options?.includes('isValue'))
      .map((field) => field.name);
    const referenceValueFields = await this.getReferenceValueFields(
      currentUser,
      template,
      readableTemplateCache,
    );
    const preferred = candidates
      .filter((field) => preferredFields.has(field.name))
      .map((field) => field.name);
    const remaining = candidates.map((field) => field.name);

    return {
      fields: [
        ...new Set([
          ...searchableScalarValueFields,
          ...referenceValueFields
            .filter((field) => field.isSearchable)
            .map((field) => field.path),
          ...preferred,
          ...remaining,
        ]),
      ],
      valueFields: [
        ...scalarValueFields,
        ...referenceValueFields.map(({ path, referenceRoot }) => ({
          path,
          referenceRoot,
        })),
      ],
      relations: [
        ...new Set(referenceValueFields.map((field) => field.referenceRoot)),
      ],
    };
  }

  protected async getReferenceValueFields(
    currentUser: PersonItem,
    template: EntityTemplateDto[],
    readableTemplateCache: ReadableTemplateCache,
  ): Promise<ReferenceValueField[]> {
    const valueReferences = template.filter(
      (field) =>
        field.isReference &&
        ['m:1', '1:1'].includes(field.kind ?? '') &&
        field.options?.includes('isValue') &&
        Boolean(field.referenceName),
    );
    const resultSets = await Promise.all(
      valueReferences.map(async (reference) => {
        try {
          const referenceTemplate = await this.getUniversallyReadableTemplate(
            currentUser,
            reference.referenceName,
            readableTemplateCache,
          );
          return referenceTemplate
            .filter(
              (field) =>
                !field.isReference && field.options?.includes('isValue'),
            )
            .map((field) => ({
              path: `${reference.name}.${field.name}`,
              referenceRoot: reference.name,
              isSearchable: this.isSearchableTextField(field),
            }));
        } catch (error) {
          global.log?.warn?.(
            `global search skipped value reference ${reference.name}:`,
            error,
          );
          return [];
        }
      }),
    );

    return resultSets.flat();
  }

  protected isSearchableTextField(field: EntityTemplateDto): boolean {
    return (
      field.isPersistent !== false &&
      !field.isReference &&
      !field.options?.includes('isSecurity') &&
      !field.options?.includes('isSearchExcluded') &&
      !field.options?.includes('isSystem') &&
      this.isStringLikeField(field)
    );
  }

  protected isStringLikeField(field: EntityTemplateDto): boolean {
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

  protected getMatches(
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

  protected scoreRecord(
    label: string,
    matches: MatchPreview[],
    query: string,
    recordHandle: string | number,
  ): number {
    const normalizedLabel = this.normalizeComparableText(label);
    const normalizedQuery = this.normalizeComparableText(query);
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

  protected getDisplayValue(
    record: Record<string, unknown>,
    valueFields: ValueField[],
  ): string {
    const scalarValues: string[] = [];
    const referenceValues = new Map<string, string[]>();

    for (const field of valueFields) {
      const value = this.getRecordTextValue(record, field.path);
      if (!value) continue;

      if (!field.referenceRoot) {
        scalarValues.push(value);
        continue;
      }

      const values = referenceValues.get(field.referenceRoot) ?? [];
      values.push(value);
      referenceValues.set(field.referenceRoot, values);
    }

    return [
      scalarValues.join(' ').trim(),
      ...[...referenceValues.values()].map((values) => values.join(' ').trim()),
    ]
      .filter(Boolean)
      .join('\n');
  }

  protected getRecordTextValue(
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

  protected getNestedValue(
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

  protected getRecordHandle(
    record: Record<string, unknown>,
  ): string | number | null {
    const handle = record.handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }

  protected buildRecordPath(
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

  protected getRoutes(entity: SearchableEntity): EntityRouteItem[] {
    const routes = entity.routes;
    if (Array.isArray(routes)) {
      return routes;
    }

    if (routes && typeof routes.getItems === 'function') {
      return routes.getItems();
    }

    return [];
  }

  protected isExactHandleCandidate(
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

  protected normalizeHandleQuery(
    field: EntityTemplateDto,
    query: string,
  ): string | number {
    const normalizedType = this.normalizeFieldType(field.type);
    return ['number', 'integer', 'integertype'].includes(normalizedType)
      ? Number(query)
      : query;
  }

  protected normalizeQuery(query: unknown): string {
    return typeof query === 'string'
      ? query.trim().slice(0, MAX_GLOBAL_SEARCH_QUERY_LENGTH)
      : '';
  }

  protected normalizeComparableText(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  protected normalizeLimit(limit: unknown): number {
    const parsedLimit = Number(limit);
    if (!Number.isFinite(parsedLimit)) {
      return DEFAULT_GLOBAL_SEARCH_LIMIT;
    }

    return Math.max(
      1,
      Math.min(MAX_GLOBAL_SEARCH_LIMIT, Math.floor(parsedLimit)),
    );
  }

  protected normalizeRequestedEntityHandles(entityHandles: unknown): string[] {
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

  protected getSearchTerms(query: string): string[] {
    return query
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= MIN_GLOBAL_SEARCH_QUERY_LENGTH);
  }

  protected stripLikeWildcards(value: string): string {
    return value.replace(/[%_]/g, '').trim();
  }

  protected truncatePreview(value: string): string {
    return value.length > 140 ? `${value.slice(0, 137)}...` : value;
  }

  protected normalizeFieldType(type: unknown): string {
    return typeof type === 'string' ? type.toLowerCase() : '';
  }

  protected async runWithConcurrency<T>(
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
