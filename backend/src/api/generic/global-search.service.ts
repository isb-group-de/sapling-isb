import { Injectable, Optional } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PersonItem } from '../../entity/PersonItem';
import { TemplateService } from '../template/template.service';
import { CurrentService } from '../current/current.service';
import { GenericService } from './generic.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { FieldPermissionService } from '../current/field-permission.service';
import {
  GlobalSearchQueryDto,
  GlobalSearchResponseDto,
} from './dto/global-search.dto';
import { GlobalSearchIndexService } from './global-search-index.service';
import { GlobalSearchOperations } from './global-search.operations';
import {
  ENTITY_SEARCH_CONCURRENCY,
  MIN_GLOBAL_SEARCH_QUERY_LENGTH,
  type ReadableTemplateCache,
} from './global-search.types';

@Injectable()
export class GlobalSearchService extends GlobalSearchOperations {
  constructor(
    em: EntityManager,
    currentService: CurrentService,
    genericService: GenericService,
    templateService: TemplateService,
    fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(templateService.getEntityTemplate(entityHandle)),
      applyTemplateAccess: (
        _user: PersonItem,
        _entityHandle: string,
        templates: EntityTemplateDto[],
      ): EntityTemplateDto[] => templates,
      assertReadableFields: () => Promise.resolve(),
      filterUniversallyReadableFields: (
        _user: PersonItem,
        _entityHandle: string,
        templates: EntityTemplateDto[],
      ): EntityTemplateDto[] => templates,
    } as unknown as FieldPermissionService,
    @Optional()
    searchIndex?: GlobalSearchIndexService,
  ) {
    super(
      em,
      currentService,
      genericService,
      templateService,
      fieldPermissions,
      searchIndex,
    );
  }

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
    const readableTemplateCache: ReadableTemplateCache = new Map();

    if (this.searchIndex?.isEnabled()) {
      return this.searchIndexed(
        hydratedUser,
        query,
        limit,
        entities,
        terms,
        perEntityLimit,
        readableTemplateCache,
      );
    }

    const resultSets = await this.runWithConcurrency(
      entities.map(
        (entity) => async () =>
          this.searchEntitySafely({
            entity,
            query,
            terms,
            perEntityLimit,
            currentUser: hydratedUser,
            readableTemplateCache,
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
}
