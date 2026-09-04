import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Collection,
  EntityManager,
  Reference,
  type EntityClass,
} from '@mikro-orm/core';
import type {
  AutomationAssignment,
  AutomationCondition,
  AutomationPathStep,
} from '../../entity/FieldAutomationItem';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { TemplateService } from '../template/template.service';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

type AutomationNode = {
  entity: string;
  handle: string;
  snapshot?: Record<string, unknown>;
};

@Injectable()
export class AutomationReferenceResolverService {
  constructor(
    private readonly em: EntityManager,
    private readonly templates: TemplateService,
  ) {}

  population(entity: string): string[] {
    return this.templates
      .getEntityTemplate(entity)
      .filter((field) => field.isReference)
      .map((field) => field.name);
  }

  validate(
    sourceEntity: string,
    targetEntity: string,
    path: AutomationPathStep[],
  ): void {
    let current = sourceEntity;
    for (const step of path ?? []) current = this.nextEntity(current, step);
    if (current !== targetEntity)
      throw new BadRequestException('automation.invalidReferencePath');
  }

  validateConfiguration(
    sourceEntity: string,
    targetEntity: string,
    path: AutomationPathStep[],
    conditions: AutomationCondition[] = [],
    assignments: AutomationAssignment[] = [],
  ): void {
    this.validate(sourceEntity, targetEntity, path);
    const sourceFields = this.templates.getEntityTemplate(sourceEntity);
    const targetFields = this.templates.getEntityTemplate(targetEntity);
    for (const condition of conditions) {
      const fields = condition.scope === 'source' ? sourceFields : targetFields;
      if (
        !fields.some(
          (field) =>
            field.name === condition.field &&
            !field.options?.includes('isSecurity'),
        )
      )
        throw new BadRequestException('automation.invalidConditionField');
    }
    for (const assignment of assignments) {
      const field = targetFields.find(
        (candidate) => candidate.name === assignment.field,
      );
      if (
        !field ||
        !field.isPersistent ||
        field.isAutoIncrement ||
        field.name === 'handle' ||
        ['1:m', 'm:n', 'n:m'].includes(field.kind ?? '') ||
        field.options?.some((option) =>
          ['isReadOnly', 'isSystem', 'isSecurity'].includes(option),
        )
      )
        throw new BadRequestException('automation.invalidAssignmentField');
    }
  }

  async resolve(
    sourceEntity: string,
    sourceHandle: string,
    targetEntity: string,
    path: AutomationPathStep[],
    snapshot?: Record<string, unknown> | null,
    context?: Record<string, unknown> | null,
  ): Promise<string[]> {
    this.validate(sourceEntity, targetEntity, path ?? []);
    let nodes: AutomationNode[] = [
      {
        entity: sourceEntity,
        handle: sourceHandle,
        snapshot: snapshot ?? undefined,
      },
    ];
    for (const [index, step] of (path ?? []).entries()) {
      const resolved = await Promise.all(
        nodes.map((node) =>
          this.follow(node, step, index === 0 ? context : null),
        ),
      );
      nodes = resolved.flat();
    }
    return [
      ...new Set(
        nodes
          .filter((node) => node.entity === targetEntity)
          .map((node) => node.handle),
      ),
    ];
  }

  private async follow(
    node: AutomationNode,
    step: AutomationPathStep,
    context?: Record<string, unknown> | null,
  ): Promise<AutomationNode[]> {
    if (step.direction === 'inverse') {
      if (!step.entity)
        throw new BadRequestException('automation.invalidReferencePath');
      const field = this.field(step.entity, step.field);
      const where: Record<string, unknown> = field.genericReference
        ? {
            [field.genericReference.entityField]: node.entity,
            [field.genericReference.handleField]: node.handle,
          }
        : { [step.field]: node.handle };
      const records = await this.em.find(this.entityClass(step.entity), where);
      return records.flatMap((record) => {
        const handle = this.scalar((record as { handle?: unknown }).handle);
        return handle == null
          ? []
          : [{ entity: step.entity!, handle: String(handle) }];
      });
    }

    const field = this.field(node.entity, step.field);
    const relationHandle = context?.referenceHandle;
    if (
      context?.referenceName === step.field &&
      typeof context.referenceEntity === 'string' &&
      (typeof relationHandle === 'string' || typeof relationHandle === 'number')
    ) {
      return [
        {
          entity: context.referenceEntity,
          handle: String(relationHandle),
        },
      ];
    }

    const record =
      node.snapshot ??
      (await this.em.findOne(
        this.entityClass(node.entity),
        { handle: node.handle },
        { populate: [step.field] as never[] },
      ));
    if (!record) return [];
    if (field.genericReference) {
      const entity = this.scalar(record[field.genericReference.entityField]);
      const handle = this.scalar(record[field.genericReference.handleField]);
      return typeof entity === 'string' && handle != null
        ? [{ entity, handle: String(handle) }]
        : [];
    }
    const values = this.values(record[step.field]);
    return values.flatMap((value) => {
      const handle = this.scalar(value);
      return field.referenceName && handle != null
        ? [{ entity: field.referenceName, handle: String(handle) }]
        : [];
    });
  }

  private nextEntity(current: string, step: AutomationPathStep): string {
    if (step.direction === 'inverse') {
      if (!step.entity)
        throw new BadRequestException('automation.invalidReferencePath');
      const field = this.field(step.entity, step.field);
      if (!field.genericReference && field.referenceName !== current)
        throw new BadRequestException('automation.invalidReferencePath');
      return step.entity;
    }
    const field = this.field(current, step.field);
    if (field.genericReference) return step.entity ?? '*';
    if (!field.referenceName)
      throw new BadRequestException('automation.invalidReferencePath');
    return field.referenceName;
  }

  private field(entity: string, name: string): EntityTemplateDto {
    this.entityClass(entity);
    const field = this.templates
      .getEntityTemplate(entity)
      .find((candidate) => candidate.name === name);
    if (
      !field ||
      field.options?.includes('isSecurity') ||
      (!field.isReference && !field.genericReference)
    )
      throw new BadRequestException('automation.invalidReferencePath');
    return field;
  }

  private entityClass(entity: string): EntityClass<object> {
    const entityClass = ENTITY_MAP[entity] as unknown;
    if (!entityClass)
      throw new BadRequestException('automation.invalidReferencePath');
    return entityClass as EntityClass<object>;
  }

  private values(value: unknown): unknown[] {
    if (value instanceof Collection) return value.getItems(false);
    return Array.isArray(value) ? value : value == null ? [] : [value];
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (Reference.isReference(value)) value = value.unwrap();
    if (value && typeof value === 'object' && 'handle' in value)
      value = (value as { handle?: unknown }).handle;
    return typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
      ? value
      : null;
  }
}
