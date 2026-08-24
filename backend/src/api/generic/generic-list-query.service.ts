import { BadRequestException, Injectable } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { GENERIC_DOWNLOAD_LIMIT } from '../../constants/project.constants';
import { PersonItem } from '../../entity/PersonItem';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericCustomFieldService } from './generic-custom-field.service';
import { GenericQueryService } from './generic-query.service';
import { GenericReadService } from './generic-read.service';
import { GenericSanitizerService } from './generic-sanitizer.service';
import { FieldPermissionService } from '../current/field-permission.service';

export interface GenericListResult {
  data: object[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    executionTime: number;
  };
}

/** Executes permission-aware generic list and JSON export queries. */
@Injectable()
export class GenericListQueryService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly genericQueryService: GenericQueryService,
    private readonly genericReadService: GenericReadService,
    private readonly genericSanitizerService: GenericSanitizerService,
    private readonly genericCustomFieldService: GenericCustomFieldService,
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(this.templateService.getEntityTemplate(entityHandle)),
      assertReadableQuery: () => Promise.resolve(),
      assertReadableFields: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
  ) {}

  async findAndCount(
    entityHandle: string,
    where: object,
    page: number,
    limit: number,
    orderBy: object,
    currentUser: PersonItem,
    relations: string[],
    fields: string[],
  ): Promise<GenericListResult> {
    const startTime = performance.now();
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const offset = (page - 1) * limit;
    const template = await this.fieldPermissions.getTemplates(entityHandle);
    await Promise.all([
      this.fieldPermissions.assertReadableQuery(
        currentUser,
        entityHandle,
        where,
      ),
      this.fieldPermissions.assertReadableQuery(
        currentUser,
        entityHandle,
        orderBy,
      ),
      this.fieldPermissions.assertReadableFields(currentUser, entityHandle, [
        ...fields,
        ...relations,
      ]),
    ]);
    const normalizedWhere = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      await this.genericCustomFieldService.applyCustomFieldFilters(
        entityHandle,
        where,
      ),
      'filter',
    );
    const normalizedOrderBy = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      this.removeCustomFieldOrderBy(orderBy),
      'orderBy',
    );
    const populate = this.buildPopulate(
      entityHandle,
      normalizedWhere,
      normalizedOrderBy,
      relations,
      template,
    );
    const selectedFields = this.genericQueryService.buildFields(
      fields,
      template,
      populate,
    );
    const result = await this.genericReadService.findAndCount(
      entityHandle,
      entityClass,
      normalizedWhere,
      currentUser,
      template,
      {
        limit,
        offset,
        orderBy: normalizedOrderBy,
        populate: populate as any[],
        fields: selectedFields as any[] | undefined,
      },
    );

    let resolvedPage = page;
    let resolvedLimit = limit;
    if (resolvedPage == null) {
      resolvedLimit = result.total;
      resolvedPage = 1;
    }

    let items = await this.genericReadService.applyAfterRead(
      result.items,
      result.entity,
      currentUser,
    );
    items = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      items,
    );
    items = this.genericSanitizerService.projectEntityResult(
      entityHandle,
      items,
      currentUser,
      template,
    );

    return {
      data: items,
      meta: {
        total: result.total,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages: Math.ceil(result.total / resolvedLimit),
        executionTime: (performance.now() - startTime) / 1000,
      },
    };
  }

  /**
   * Permission-aware bounded list read without the expensive total-count query.
   * Intended for lookup/search consumers that never expose pagination totals.
   */
  async find(
    entityHandle: string,
    where: object,
    limit: number,
    orderBy: object,
    currentUser: PersonItem,
    relations: string[],
    fields: string[] = [],
  ): Promise<object[]> {
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const template = await this.fieldPermissions.getTemplates(entityHandle);
    await Promise.all([
      this.fieldPermissions.assertReadableQuery(
        currentUser,
        entityHandle,
        where,
      ),
      this.fieldPermissions.assertReadableQuery(
        currentUser,
        entityHandle,
        orderBy,
      ),
      this.fieldPermissions.assertReadableFields(currentUser, entityHandle, [
        ...fields,
        ...relations,
      ]),
    ]);
    const normalizedWhere = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      await this.genericCustomFieldService.applyCustomFieldFilters(
        entityHandle,
        where,
      ),
      'filter',
    );
    const normalizedOrderBy = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      this.removeCustomFieldOrderBy(orderBy),
      'orderBy',
    );
    const populate = this.buildPopulate(
      entityHandle,
      normalizedWhere,
      normalizedOrderBy,
      relations,
      template,
    );
    const selectedFields = this.genericQueryService.buildFields(
      fields,
      template,
      populate,
    );
    const result = await this.genericReadService.find(
      entityHandle,
      entityClass,
      normalizedWhere,
      currentUser,
      template,
      {
        limit,
        orderBy: normalizedOrderBy,
        populate: populate as any[],
        fields: selectedFields as any[] | undefined,
      },
    );
    let items = await this.genericReadService.applyAfterRead(
      result.items,
      result.entity,
      currentUser,
    );
    items = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      items,
    );
    return this.genericSanitizerService.projectEntityResult(
      entityHandle,
      items,
      currentUser,
      template,
    );
  }

  async downloadJSON(
    entityHandle: string,
    where: object,
    orderBy: object,
    currentUser: PersonItem,
    relations: string[],
  ): Promise<string> {
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const template = await this.fieldPermissions.getTemplates(entityHandle);
    await Promise.all([
      this.fieldPermissions.assertReadableQuery(
        currentUser,
        entityHandle,
        where,
      ),
      this.fieldPermissions.assertReadableQuery(
        currentUser,
        entityHandle,
        orderBy,
      ),
      this.fieldPermissions.assertReadableFields(
        currentUser,
        entityHandle,
        relations,
      ),
    ]);
    const normalizedWhere = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      await this.genericCustomFieldService.applyCustomFieldFilters(
        entityHandle,
        where,
      ),
      'filter',
    );
    const normalizedOrderBy = this.genericQueryService.normalizeQueryCriteria(
      entityHandle,
      this.removeCustomFieldOrderBy(orderBy),
      'orderBy',
    );
    const populate = this.buildPopulate(
      entityHandle,
      normalizedWhere,
      normalizedOrderBy,
      relations,
      template,
    );
    const result = await this.genericReadService.find(
      entityHandle,
      entityClass,
      normalizedWhere,
      currentUser,
      template,
      {
        limit: GENERIC_DOWNLOAD_LIMIT + 1,
        orderBy: normalizedOrderBy,
        populate: populate as any[],
        runBeforeReadScript: entityHandle === 'dashboardTemplate',
      },
    );

    if (result.items.length > GENERIC_DOWNLOAD_LIMIT) {
      throw new BadRequestException('exception.exportLimitExceeded');
    }

    const hydrated = await this.genericCustomFieldService.hydrateRecords(
      entityHandle,
      result.items,
    );
    const projected = this.genericSanitizerService.projectEntityResult(
      entityHandle,
      hydrated,
      currentUser,
      template,
    );
    return JSON.stringify(projected, null, 2);
  }

  private buildPopulate(
    entityHandle: string,
    where: object,
    orderBy: object,
    relations: string[],
    template: EntityTemplateDto[],
  ) {
    return this.genericQueryService.buildPopulate(
      [
        ...relations,
        ...this.genericQueryService.collectQueryPopulateRelations(
          entityHandle,
          where,
        ),
        ...this.genericQueryService.collectQueryPopulateRelations(
          entityHandle,
          orderBy,
        ),
      ],
      template,
    );
  }

  private removeCustomFieldOrderBy(orderBy: object): object {
    if (!orderBy || typeof orderBy !== 'object' || Array.isArray(orderBy)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(orderBy as Record<string, unknown>).filter(
        ([key]) => !key.startsWith('customFields.'),
      ),
    );
  }
}
