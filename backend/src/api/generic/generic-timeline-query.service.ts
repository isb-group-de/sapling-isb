import { Injectable, NotFoundException } from '@nestjs/common';
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
    const mainTemplate = this.templateService.getEntityTemplate(entityHandle);
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
    const descriptors =
      this.genericTimelineService.getTimelineRelationDescriptors(
        entityHandle,
        currentUser,
      );
    const datasets = await this.loadTimelineDescriptorDatasets(
      descriptors,
      normalizedHandle,
      currentUser,
      cursorMonth,
    );
    const lowerBound =
      this.genericTimelineService.getTimelineLowerBound(datasets);

    const response = new TimelineResponseDto();
    response.entityHandle = entityHandle;
    response.handle = normalizedHandle;
    response.anchor = anchor;

    if (!lowerBound) {
      response.hasMore = false;
      response.nextBefore = null;
      return response;
    }

    let currentMonth = this.genericTimelineService.getMonthStart(cursorMonth);
    while (
      response.months.length < normalizedMonths &&
      currentMonth.getTime() >= lowerBound.getTime()
    ) {
      const window =
        this.genericTimelineService.createTimelineMonthWindow(currentMonth);
      response.months.push(
        this.genericTimelineService.buildTimelineMonth(datasets, window),
      );
      currentMonth = this.genericTimelineService.addMonths(currentMonth, -1);
    }

    response.hasMore = currentMonth.getTime() >= lowerBound.getTime();
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
      ? this.genericSanitizerService.sanitizeEntityResult(
          entityHandle,
          result.item,
          template,
        )
      : null;
  }

  private async loadTimelineDescriptorDatasets(
    descriptors: TimelineRelationDescriptor[],
    mainHandle: string | number,
    currentUser: PersonItem,
    cursorMonth: Date,
  ): Promise<TimelineDescriptorDataset[]> {
    const cursorWindow =
      this.genericTimelineService.createTimelineMonthWindow(cursorMonth);

    return Promise.all(
      descriptors.map(async (descriptor) => {
        const relationFilter =
          this.genericTimelineService.buildTimelineReverseFilter(
            descriptor.relationFields,
            mainHandle,
          );
        const records = await this.findTimelineRecords(
          descriptor.entityHandle,
          this.genericTimelineService.combineWhere(
            relationFilter,
            this.genericTimelineService.buildTimelineRecordUpperBoundFilter(
              descriptor.dateFields,
              cursorWindow.end,
            ),
          ),
          descriptor.template,
          currentUser,
        );

        return { descriptor, relationFilter, records };
      }),
    );
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

    return this.genericSanitizerService.sanitizeEntityResult(
      entityHandle,
      result.items as TimelineRecordResult[],
      template,
    );
  }
}
