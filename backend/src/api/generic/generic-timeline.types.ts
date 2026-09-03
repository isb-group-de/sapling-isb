import { EntityTemplateDto } from '../template/dto/entity-template.dto';

export type TimelineDateFieldConfig = {
  startFieldName: string;
  endFieldName: string;
  startFallbackFieldName: string;
  endFallbackFieldName: string;
};

export type TimelineRelationDescriptor = {
  entityHandle: string;
  template: EntityTemplateDto[];
  relationFields: EntityTemplateDto[];
  relationCategory: string | null;
  dateFields: TimelineDateFieldConfig;
  chipFields: EntityTemplateDto[];
  booleanFields: EntityTemplateDto[];
  moneyField: EntityTemplateDto | null;
};

export type TimelineDescriptorDataset = {
  descriptor: TimelineRelationDescriptor;
  relationFilter: object;
  records: Record<string, unknown>[];
};

export type TimelineDateSpan = {
  start: Date | null;
  end: Date | null;
};

export type TimelineMonthWindow = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

export type TimelineGroupIdentity = {
  key: string;
  label: string;
  color?: string | null;
  icon?: string | null;
  rawValue: string | number | boolean | null;
};

export type TimelineRecordResult = Record<string, unknown> & {
  updatedAt?: Date;
  createdAt?: Date;
};
