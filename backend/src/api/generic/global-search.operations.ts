import { EntityItem } from '../../entity/EntityItem';
import type { PersonItem } from '../../entity/PersonItem';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type {
  GlobalSearchResponseDto,
  GlobalSearchResultDto,
} from './dto/global-search.dto';
import { GLOBAL_SEARCH_INDEX_ENTITY_HANDLE } from '../../entity/GlobalSearchIndexItem';
import type { GenericService } from './generic.service';
import type { GlobalSearchIndexScope } from './global-search-index.service';
import type {
  EntitySearchContext,
  ReadableTemplateCache,
  SearchableEntity,
  ValueField,
} from './global-search.types';
import { ENTITY_SEARCH_CONCURRENCY } from './global-search.types';
import { GlobalSearchResultOperations } from './global-search-result.operations';

export class GlobalSearchOperations extends GlobalSearchResultOperations {
  protected async searchIndexed(
    currentUser: PersonItem,
    query: string,
    limit: number,
    entities: SearchableEntity[],
    terms: string[],
    perEntityLimit: number,
    readableTemplateCache: ReadableTemplateCache,
  ): Promise<GlobalSearchResponseDto> {
    if (!this.searchIndex) {
      return { query, items: [] };
    }
    const contexts = (
      await this.runWithConcurrency(
        entities.map((entity) => async () => {
          try {
            const template = await this.getUniversallyReadableTemplate(
              currentUser,
              entity.handle,
              readableTemplateCache,
            );
            const configuration = await this.getSearchConfiguration(
              currentUser,
              template,
              readableTemplateCache,
            );
            return {
              entity,
              template,
              ...configuration,
            };
          } catch (error) {
            global.log?.warn?.(
              `global search skipped indexed entity ${entity.handle}:`,
              error,
            );
            return null;
          }
        }),
        ENTITY_SEARCH_CONCURRENCY,
      )
    ).filter(
      (
        context,
      ): context is {
        entity: SearchableEntity;
        template: EntityTemplateDto[];
        fields: string[];
        valueFields: ValueField[];
        relations: string[];
      } => context !== null && context.fields.length > 0,
    );
    if (contexts.length === 0) {
      return { query, items: [] };
    }
    const scopes: GlobalSearchIndexScope[] = contexts.map((context) => ({
      entityHandle: context.entity.handle,
      fieldPaths: context.fields,
    }));
    const candidates = await this.searchIndex.findCandidates(
      scopes,
      query,
      Math.max(limit * 10, 50),
    );
    const handlesByEntity = new Map<string, string[]>();
    for (const candidate of candidates) {
      const handles = handlesByEntity.get(candidate.entityHandle) ?? [];
      if (!handles.includes(candidate.recordHandle)) {
        handles.push(candidate.recordHandle);
        handlesByEntity.set(candidate.entityHandle, handles);
      }
    }

    const resultSets = await this.runWithConcurrency(
      contexts
        .filter((context) => handlesByEntity.has(context.entity.handle))
        .map((context) => async () => {
          const rawHandles = handlesByEntity.get(context.entity.handle) ?? [];
          const handleField = context.template.find(
            (field) => field.name === 'handle',
          );
          const handles = handleField
            ? rawHandles.map((handle) =>
                this.normalizeHandleQuery(handleField, handle),
              )
            : rawHandles;
          const records = await this.findSearchRecords(
            context.entity.handle,
            { handle: { $in: handles } },
            Math.min(rawHandles.length, Math.max(limit * 3, perEntityLimit)),
            {},
            currentUser,
            context.relations,
          );
          const searchContext: EntitySearchContext = {
            entity: context.entity,
            template: context.template,
            fields: context.fields,
            valueFields: context.valueFields,
            relations: context.relations,
            query,
            terms,
            perEntityLimit,
            currentUser,
          };
          return records
            .map((record) =>
              this.toResult(searchContext, record as Record<string, unknown>),
            )
            .filter(
              (item): item is GlobalSearchResultDto =>
                item !== null && this.isCurrentMatch(item, query),
            );
        }),
      ENTITY_SEARCH_CONCURRENCY,
    );

    return {
      query,
      items: resultSets
        .flat()
        .sort(
          (left, right) =>
            right.score - left.score || left.label.localeCompare(right.label),
        )
        .slice(0, limit),
    };
  }

  protected isCurrentMatch(
    item: GlobalSearchResultDto,
    query: string,
  ): boolean {
    const normalizedQuery = this.normalizeComparableText(query);
    return (
      this.normalizeComparableText(item.label).includes(normalizedQuery) ||
      String(item.recordHandle).toLowerCase() === normalizedQuery ||
      item.matches.length > 0
    );
  }

  protected async findSearchRecords(
    entityHandle: string,
    where: object,
    limit: number,
    orderBy: object,
    currentUser: PersonItem,
    relations: string[],
  ): Promise<object[]> {
    const service = this.genericService as GenericService & {
      findWithoutCount?: GenericService['findWithoutCount'];
    };
    if (typeof service.findWithoutCount === 'function') {
      return service.findWithoutCount(
        entityHandle,
        where,
        limit,
        orderBy,
        currentUser,
        relations,
      );
    }

    const result = await this.genericService.findAndCount(
      entityHandle,
      where,
      1,
      limit,
      orderBy,
      currentUser,
      relations,
    );
    return result.data;
  }

  protected async searchEntitySafely(
    context: Omit<
      EntitySearchContext,
      'template' | 'fields' | 'valueFields' | 'relations'
    > & { readableTemplateCache: ReadableTemplateCache },
  ): Promise<GlobalSearchResultDto[]> {
    try {
      const template = await this.getUniversallyReadableTemplate(
        context.currentUser,
        context.entity.handle,
        context.readableTemplateCache,
      );
      const { fields, valueFields, relations } =
        await this.getSearchConfiguration(
          context.currentUser,
          template,
          context.readableTemplateCache,
        );

      if (fields.length === 0) {
        return [];
      }

      const searchContext: EntitySearchContext = {
        entity: context.entity,
        query: context.query,
        terms: context.terms,
        perEntityLimit: context.perEntityLimit,
        currentUser: context.currentUser,
        template,
        fields,
        valueFields,
        relations,
      };
      const where = this.buildSearchWhere(searchContext);
      const orderBy = template.some((field) => field.name === 'updatedAt')
        ? { updatedAt: 'DESC' }
        : {};
      const records = await this.findSearchRecords(
        context.entity.handle,
        where,
        context.perEntityLimit,
        orderBy,
        context.currentUser,
        relations,
      );

      return records
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

  protected async getSearchableEntities(
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
      (handle) =>
        handle !== GLOBAL_SEARCH_INDEX_ENTITY_HANDLE &&
        (!requestedHandleSet || requestedHandleSet.has(handle)),
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

    return entities.filter(
      (entity) => entity.canRead !== false && this.getRoutes(entity).length > 0,
    );
  }
}
