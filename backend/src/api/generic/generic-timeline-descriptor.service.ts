import { Injectable } from '@nestjs/common';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { PersonItem } from '../../entity/PersonItem';
import { CurrentService } from '../current/current.service';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type {
  TimelineDateFieldConfig,
  TimelineRelationDescriptor,
} from './generic-timeline.types';

/** Discovers readable timeline relations and their metadata. */
@Injectable()
export class GenericTimelineDescriptorService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly currentService: CurrentService,
  ) {}

  getRelationDescriptors(
    mainEntityHandle: string,
    currentUser: PersonItem,
  ): TimelineRelationDescriptor[] {
    return ENTITY_REGISTRY.flatMap(({ name }) => {
      if (name === mainEntityHandle) {
        return [];
      }

      const permission = this.currentService.getEntityPermissions(
        currentUser,
        name,
      );
      if (!permission.allowRead) {
        return [];
      }

      const template = this.templateService.getEntityTemplate(name);
      const candidateRelationFields = template.filter(
        (field) =>
          field.kind === 'm:1' &&
          field.referenceName === mainEntityHandle &&
          !field.options?.includes('isSecurity') &&
          !field.options?.includes('isSystem') &&
          !field.options?.includes('isHideAsReference'),
      );
      const relationFieldGroups = this.groupRelationFields(
        candidateRelationFields,
        mainEntityHandle,
      );

      return relationFieldGroups.map((relationFields) => ({
        entityHandle: name,
        template,
        relationFields,
        relationCategory: relationFields.length > 1 ? 'reference' : null,
        dateFields: this.getDateFieldConfig(template),
        chipFields: template.filter(
          (field) =>
            field.options?.includes('isChip') &&
            !field.options?.includes('isSecurity') &&
            !field.options?.includes('isSystem'),
        ),
        booleanFields: template.filter(
          (field) =>
            field.type === 'boolean' &&
            !field.options?.includes('isSecurity') &&
            !field.options?.includes('isSystem'),
        ),
        moneyField:
          template.find(
            (field) =>
              field.options?.includes('isMoney') &&
              !field.options?.includes('isSecurity') &&
              !field.options?.includes('isSystem'),
          ) ?? null,
      }));
    });
  }

  buildReverseFilter(
    relationFields: EntityTemplateDto[],
    handle: string | number,
  ): object {
    const clauses = relationFields.map((field) => ({ [field.name]: handle }));
    if (clauses.length === 0) {
      return {};
    }
    return clauses.length === 1 ? clauses[0] : { $or: clauses };
  }

  getDateFieldConfig(template: EntityTemplateDto[]): TimelineDateFieldConfig {
    const startField =
      template.find((field) => field.options?.includes('isDateStart')) ??
      template.find((field) => field.name === 'createdAt') ??
      null;
    const endField =
      template.find((field) => field.options?.includes('isDateEnd')) ??
      template.find((field) => field.name === 'updatedAt') ??
      null;

    return {
      startFieldName: startField?.name ?? 'createdAt',
      endFieldName: endField?.name ?? 'updatedAt',
      startFallbackFieldName: 'createdAt',
      endFallbackFieldName: 'updatedAt',
    };
  }

  private groupRelationFields(
    relationFields: EntityTemplateDto[],
    mainEntityHandle: string,
  ): EntityTemplateDto[][] {
    const prioritizedOption =
      mainEntityHandle === 'person'
        ? 'isPerson'
        : mainEntityHandle === 'company'
          ? 'isCompany'
          : null;

    if (!prioritizedOption) {
      return relationFields.length > 0 ? [relationFields] : [];
    }

    const prioritizedFields = relationFields.filter((field) =>
      field.options?.includes(prioritizedOption),
    );
    if (prioritizedFields.length <= 1) {
      return relationFields.length > 0 ? [relationFields] : [];
    }

    const prioritizedNames = new Set(
      prioritizedFields.map((field) => field.name),
    );
    const remainingFields = relationFields.filter(
      (field) => !prioritizedNames.has(field.name),
    );
    return [
      ...prioritizedFields.map((field) => [field]),
      ...(remainingFields.length > 0 ? [remainingFields] : []),
    ];
  }
}
