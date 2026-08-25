import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { TimelineResponseDto } from './dto/timeline-response.dto';
import { GenericQueryService } from './generic-query.service';
import { GenericReadService } from './generic-read.service';
import { GenericReferenceService } from './generic-reference.service';
import { GenericSanitizerService } from './generic-sanitizer.service';
import {
  GenericTimelineService,
  TimelineDescriptorDataset,
  TimelineRecordResult,
  TimelineRelationDescriptor,
} from './generic-timeline.service';
import { FieldPermissionService } from '../current/field-permission.service';

type LoadedTimelineDescriptorDataset = TimelineDescriptorDataset & {
  hasOlderRecords: boolean;
};

/** Loads permission-filtered timeline records and composes the paged response. */
@Injectable()
export class GenericTimelineQueryService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly genericQueryService: GenericQueryService,
    private readonly genericReadService: GenericReadService,
    private readonly genericReferenceService: GenericReferenceService,
    private readonly genericSanitizerService: GenericSanitizerService,
    private readonly genericTimelineService: GenericTimelineService,
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(this.templateService.getEntityTemplate(entityHandle)),
      applyTemplateAccess: (
        _user: PersonItem,
        _entityHandle: string,
        templates: EntityTemplateDto[],
      ): EntityTemplateDto[] => templates,
      assertReadableFields: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
  ) {}

  async getRecordTimeline(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
    before?: string,
    months = 6,
  ): Promise<TimelineResponseDto> {
    const normalizedHandle = this.genericReferenceService.normalizeHandleValue(
      entityHandle,
      handle,
    );
    const normalizedMonths = Number.isFinite(months)
      ? Math.max(1, Math.min(12, Number(months)))
      : 6;
    const mainTemplate = this.getReadableTemplate(
      currentUser,
      entityHandle,
      await this.fieldPermissions.getTemplates(entityHandle),
    );
    const mainDateFields =
      this.genericTimelineService.getTimelineDateFieldConfig(mainTemplate);
    const mainRecord = await this.findTimelineRecord(
      entityHandle,
      this.genericReferenceService.getHandleFilter(
        entityHandle,
        normalizedHandle,
      ),
      mainTemplate,
      currentUser,
    );

    if (!mainRecord) {
      throw new NotFoundException('global.notFound');
    }

    const anchor = this.genericTimelineService.buildTimelineAnchor(
      entityHandle,
      normalizedHandle,
      mainRecord,
      mainTemplate,
      mainDateFields,
    );
    const cursorMonth =
      this.genericTimelineService.parseTimelineCursor(before) ??
      this.genericTimelineService.addMonths(new Date(), 1);
    const rawDescriptors =
      this.genericTimelineService.getTimelineRelationDescriptors(
        entityHandle,
        currentUser,
      );
    const descriptors = await this.prepareDescriptors(
      rawDescriptors,
      currentUser,
    );
    const datasets = await this.loadTimelineDescriptorDatasets(
      descriptors,
      normalizedHandle,
      currentUser,
      cursorMonth,
      normalizedMonths,
    );
    const lowerBound =
      this.genericTimelineService.getTimelineLowerBound(datasets);
    const hasOlderRecords = datasets.some((dataset) => dataset.hasOlderRecords);

    const response = new TimelineResponseDto();
    response.entityHandle = entityHandle;
    response.handle = normalizedHandle;
    response.anchor = anchor;

    if (!lowerBound && !hasOlderRecords) {
      response.hasMore = false;
      response.nextBefore = null;
      return response;
    }

    let currentMonth = this.genericTimelineService.getMonthStart(cursorMonth);
    while (
      response.months.length < normalizedMonths &&
      (hasOlderRecords ||
        (lowerBound && currentMonth.getTime() >= lowerBound.getTime()))
    ) {
      const window =
        this.genericTimelineService.createTimelineMonthWindow(currentMonth);
      response.months.push(
        this.genericTimelineService.buildTimelineMonth(datasets, window),
      );
      currentMonth = this.genericTimelineService.addMonths(currentMonth, -1);
    }

    response.hasMore = hasOlderRecords;
    response.nextBefore = response.hasMore
      ? this.genericTimelineService.formatTimelineCursor(currentMonth)
      : null;
    return response;
  }

  private async findTimelineRecord(
    entityHandle: string,
    where: object,
    template: EntityTemplateDto[],
    currentUser: PersonItem,
  ): Promise<Record<string, unknown> | null> {
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const populate = this.genericQueryService.buildPopulate(['m:1'], template);
    const result = await this.genericReadService.findOne(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      { populate: populate as any[] },
    );

    return result.item
      ? this.genericSanitizerService.projectEntityResult(
          entityHandle,
          result.item,
          currentUser,
          template,
        )
      : null;
  }

  private async loadTimelineDescriptorDatasets(
    descriptors: TimelineRelationDescriptor[],
    mainHandle: string | number,
    currentUser: PersonItem,
    cursorMonth: Date,
    months: number,
  ): Promise<LoadedTimelineDescriptorDataset[]> {
    const cursorWindow =
      this.genericTimelineService.createTimelineMonthWindow(cursorMonth);
    const firstMonth = this.genericTimelineService.addMonths(
      cursorMonth,
      -(months - 1),
    );
    const firstWindow =
      this.genericTimelineService.createTimelineMonthWindow(firstMonth);

    return Promise.all(
      descriptors.map(async (descriptor) => {
        const relationFilter =
          this.genericTimelineService.buildTimelineReverseFilter(
            descriptor.relationFields,
            mainHandle,
          );
        const [records, hasOlderRecords] = await Promise.all([
          this.findTimelineRecords(
            descriptor.entityHandle,
            this.genericTimelineService.combineWhere(
              relationFilter,
              this.genericTimelineService.buildTimelineRecordWindowFilter(
                descriptor.dateFields,
                firstWindow.start,
                cursorWindow.end,
              ),
            ),
            descriptor.template,
            currentUser,
          ),
          this.hasTimelineRecordsBefore(
            descriptor.entityHandle,
            this.genericTimelineService.combineWhere(
              relationFilter,
              this.genericTimelineService.buildTimelineRecordBeforeFilter(
                descriptor.dateFields,
                firstWindow.start,
              ),
            ),
            descriptor.template,
            currentUser,
          ),
        ]);

        return { descriptor, relationFilter, records, hasOlderRecords };
      }),
    );
  }

  private async hasTimelineRecordsBefore(
    entityHandle: string,
    where: object,
    template: EntityTemplateDto[],
    currentUser: PersonItem,
  ): Promise<boolean> {
    const entityClass =
      this.genericQueryService.getEntityClass<TimelineRecordResult>(
        entityHandle,
      );
    const result = await this.genericReadService.find(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      { limit: 1, fields: ['handle'] },
    );
    return result.items.length > 0;
  }

  private async findTimelineRecords(
    entityHandle: string,
    where: object,
    template: EntityTemplateDto[],
    currentUser: PersonItem,
  ): Promise<Record<string, unknown>[]> {
    const entityClass =
      this.genericQueryService.getEntityClass<TimelineRecordResult>(
        entityHandle,
      );
    const populate = this.genericQueryService.buildPopulate(['m:1'], template);
    const result = await this.genericReadService.find(
      entityHandle,
      entityClass,
      where,
      currentUser,
      template,
      {
        populate,
        orderBy: { updatedAt: 'DESC', createdAt: 'DESC' },
      },
    );

    return this.genericSanitizerService.projectEntityResult(
      entityHandle,
      result.items as TimelineRecordResult[],
      currentUser,
      template,
    );
  }

  private async prepareDescriptors(
    descriptors: TimelineRelationDescriptor[],
    currentUser: PersonItem,
  ): Promise<TimelineRelationDescriptor[]> {
    const prepared: TimelineRelationDescriptor[] = [];
    for (const descriptor of descriptors) {
      const requiredFields = [
        ...descriptor.relationFields.map((field) => field.name),
        descriptor.dateFields.startFieldName,
        descriptor.dateFields.endFieldName,
        ...descriptor.chipFields.map((field) => field.name),
        ...descriptor.booleanFields.map((field) => field.name),
        ...(descriptor.moneyField ? [descriptor.moneyField.name] : []),
      ];
      try {
        await this.fieldPermissions.assertReadableFields(
          currentUser,
          descriptor.entityHandle,
          requiredFields,
        );
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
        continue;
      }
      const template = this.getReadableTemplate(
        currentUser,
        descriptor.entityHandle,
        await this.fieldPermissions.getTemplates(descriptor.entityHandle),
      );
      const fieldsByName = new Map(
        template.map((field) => [field.name, field]),
      );
      const relationFields = descriptor.relationFields
        .map((field) => fieldsByName.get(field.name))
        .filter((field): field is EntityTemplateDto => !!field);
      if (relationFields.length === 0) continue;
      prepared.push({
        ...descriptor,
        template,
        relationFields,
        chipFields: descriptor.chipFields
          .map((field) => fieldsByName.get(field.name))
          .filter((field): field is EntityTemplateDto => !!field),
        booleanFields: descriptor.booleanFields
          .map((field) => fieldsByName.get(field.name))
          .filter((field): field is EntityTemplateDto => !!field),
        moneyField: descriptor.moneyField
          ? (fieldsByName.get(descriptor.moneyField.name) ?? null)
          : null,
      });
    }
    return prepared;
  }

  private getReadableTemplate(
    currentUser: PersonItem,
    entityHandle: string,
    template: EntityTemplateDto[],
  ): EntityTemplateDto[] {
    return this.fieldPermissions
      .applyTemplateAccess(currentUser, entityHandle, template)
      .filter((field) => field.fieldAccess?.allowRead !== false);
  }
}
