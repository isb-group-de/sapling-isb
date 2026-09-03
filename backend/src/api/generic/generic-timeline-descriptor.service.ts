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
      const dateFields = this.getDateFieldConfig(template);

      if (!dateFields) {
        return [];
      }

      return relationFieldGroups.map((relationFields) => ({
        entityHandle: name,
        template,
        relationFields,
        relationCategory: relationFields.length > 1 ? 'reference' : null,
        dateFields,
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

  getDateFieldConfig(
    template: EntityTemplateDto[],
  ): TimelineDateFieldConfig | null {
    const persistentFields = template.filter(
      (field) => field.isPersistent !== false,
    );
    const temporalFields = persistentFields.filter((field) => {
      const type = field.type.toLowerCase();
      return (
        ['date', 'datetime', 'datetype'].includes(type) ||
        type.startsWith('timestamp')
      );
    });
    const createdAtField = temporalFields.find(
      (field) => field.name === 'createdAt',
    );
    const updatedAtField = temporalFields.find(
      (field) => field.name === 'updatedAt',
    );
    const startField =
      temporalFields.find((field) => field.options?.includes('isDateStart')) ??
      temporalFields.find((field) => field.options?.includes('isOrderDESC')) ??
      createdAtField ??
      temporalFields[0] ??
      updatedAtField;

    if (!startField) {
      return null;
    }

    const endField =
      temporalFields.find((field) => field.options?.includes('isDateEnd')) ??
      updatedAtField ??
      startField;

    return {
      startFieldName: startField.name,
      endFieldName: endField.name,
      startFallbackFieldName: createdAtField?.name ?? startField.name,
      endFallbackFieldName: updatedAtField?.name ?? endField.name,
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
