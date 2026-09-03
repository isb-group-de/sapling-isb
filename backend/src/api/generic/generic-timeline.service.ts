import { Injectable } from '@nestjs/common';
import { PersonItem } from '../../entity/PersonItem';
import { CurrentService } from '../current/current.service';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import {
  TimelineMonthDto,
  TimelineRecordAnchorDto,
} from './dto/timeline-response.dto';
import { GenericTimelineDateService } from './generic-timeline-date.service';
import { GenericTimelineDescriptorService } from './generic-timeline-descriptor.service';
import { GenericTimelineProjectionService } from './generic-timeline-projection.service';
import type {
  TimelineDateFieldConfig,
  TimelineDescriptorDataset,
  TimelineMonthWindow,
  TimelineRelationDescriptor,
} from './generic-timeline.types';

export type {
  TimelineDateFieldConfig,
  TimelineDescriptorDataset,
  TimelineMonthWindow,
  TimelineRecordResult,
  TimelineRelationDescriptor,
} from './generic-timeline.types';

/** Stable facade for timeline metadata, date filtering, and response projection. */
@Injectable()
export class GenericTimelineService {
  constructor(
    templateService: TemplateService,
    currentService: CurrentService,
    private readonly descriptorService: GenericTimelineDescriptorService = new GenericTimelineDescriptorService(
      templateService,
      currentService,
    ),
    private readonly dateService: GenericTimelineDateService = new GenericTimelineDateService(),
    private readonly projectionService: GenericTimelineProjectionService = new GenericTimelineProjectionService(
      templateService,
      dateService,
    ),
  ) {}

  buildTimelineAnchor(
    entityHandle: string,
    handle: string | number,
    record: Record<string, unknown>,
    template: EntityTemplateDto[],
    dateFields: TimelineDateFieldConfig,
  ): TimelineRecordAnchorDto {
    return this.projectionService.buildAnchor(
      entityHandle,
      handle,
      record,
      template,
      dateFields,
    );
  }

  getTimelineRelationDescriptors(
    mainEntityHandle: string,
    currentUser: PersonItem,
  ): TimelineRelationDescriptor[] {
    return this.descriptorService.getRelationDescriptors(
      mainEntityHandle,
      currentUser,
    );
  }

  buildTimelineMonth(
    datasets: TimelineDescriptorDataset[],
    monthWindow: TimelineMonthWindow,
  ): TimelineMonthDto {
    return this.projectionService.buildMonth(datasets, monthWindow);
  }

  getTimelineLowerBound(datasets: TimelineDescriptorDataset[]): Date | null {
    return this.dateService.getLowerBound(datasets);
  }

  buildTimelineReverseFilter(
    relationFields: EntityTemplateDto[],
    handle: string | number,
  ): object {
    return this.descriptorService.buildReverseFilter(relationFields, handle);
  }

  buildTimelineRecordUpperBoundFilter(
    dateFields: TimelineDateFieldConfig,
    upperBound: Date,
  ): object {
    return this.dateService.buildRecordUpperBoundFilter(dateFields, upperBound);
  }

  buildTimelineRecordWindowFilter(
    dateFields: TimelineDateFieldConfig,
    lowerBound: Date,
    upperBound: Date,
  ): object {
    return this.dateService.buildRecordWindowFilter(
      dateFields,
      lowerBound,
      upperBound,
    );
  }

  buildTimelineRecordBeforeFilter(
    dateFields: TimelineDateFieldConfig,
    boundary: Date,
  ): object {
    return this.dateService.buildRecordBeforeFilter(dateFields, boundary);
  }

  getTimelineDateFieldConfig(
    template: EntityTemplateDto[],
  ): TimelineDateFieldConfig | null {
    return this.descriptorService.getDateFieldConfig(template);
  }

  createTimelineMonthWindow(baseDate: Date): TimelineMonthWindow {
    return this.dateService.createMonthWindow(baseDate);
  }

  parseTimelineCursor(value?: string): Date | null {
    return this.dateService.parseCursor(value);
  }

  formatTimelineCursor(value: Date): string {
    return this.dateService.formatCursor(value);
  }

  getMonthStart(value: Date): Date {
    return this.dateService.getMonthStart(value);
  }

  addMonths(value: Date, delta: number): Date {
    return this.dateService.addMonths(value, delta);
  }

  combineWhere(base: object, addition: object): object {
    return this.dateService.combineWhere(base, addition);
  }
}
