import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, TransactionPropagation } from '@mikro-orm/core';
import { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import { TemplateService } from '../template/template.service';
import type { EntityTemplateDto } from '../template/dto/entity-template.dto';
import {
  GenericEntityMutationService,
  type GenericPostCommitTask,
} from './generic-entity-mutation.service';
import { GenericPermissionService } from './generic-permission.service';
import { GenericQueryService } from './generic-query.service';
import { GenericReferenceService } from './generic-reference.service';
import type {
  GenericDeleteImpactDto,
  GenericDeleteReferenceDto,
  GenericDeleteResultDto,
} from './dto/delete.dto';

type CascadeReference = GenericDeleteReferenceDto & {
  mappedBy: string;
  databaseCascade: boolean;
};

/** Coordinates delete previews and selected child cascades. */
@Injectable()
export class GenericDeleteService {
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericQueryService: GenericQueryService,
    private readonly genericPermissionService: GenericPermissionService,
    private readonly genericReferenceService: GenericReferenceService,
    private readonly genericEntityMutationService: GenericEntityMutationService,
  ) {}

  async getImpact(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
  ): Promise<GenericDeleteImpactDto> {
    const exists = await this.assertDeleteAccess(
      entityHandle,
      handle,
      currentUser,
    );
    if (!exists) {
      return { action: 'delete', references: [] };
    }

    return {
      action: 'delete',
      references: this.getCascadeReferences(entityHandle).map(
        ({ name, entityHandle: referenceEntityHandle, kind, required }) => ({
          name,
          entityHandle: referenceEntityHandle,
          kind,
          required,
        }),
      ),
    };
  }

  async delete(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
    cascadeRelations: string[] = [],
  ): Promise<GenericDeleteResultDto> {
    const exists = await this.assertDeleteAccess(
      entityHandle,
      handle,
      currentUser,
    );
    if (!exists) {
      return { action: 'deleted' };
    }

    const selectedReferences = this.resolveSelectedReferences(
      entityHandle,
      cascadeRelations,
    );
    if (selectedReferences.length === 0) {
      await this.genericEntityMutationService.delete(
        entityHandle,
        handle,
        currentUser,
        scriptContext,
        { postCommitTasks: scriptContext.postCommitTasks },
      );
      return { action: 'deleted' };
    }

    const postCommitTasks: GenericPostCommitTask[] =
      scriptContext.postCommitTasks ?? [];
    const normalizedParentHandle =
      this.genericReferenceService.normalizeHandleValue(entityHandle, handle);
    const transactionalContext: ScriptServerContext = {
      ...scriptContext,
      postCommitTasks,
    };

    await this.em.transactional(
      async () => {
        const visitedRecords = new Set<string>([
          `${entityHandle}:${String(normalizedParentHandle)}`,
        ]);
        for (const reference of selectedReferences) {
          await this.deleteRelationChildren(
            reference,
            normalizedParentHandle,
            currentUser,
            transactionalContext,
            postCommitTasks,
            visitedRecords,
          );
        }

        await this.genericEntityMutationService.delete(
          entityHandle,
          handle,
          currentUser,
          transactionalContext,
          { postCommitTasks },
        );
      },
      { propagation: TransactionPropagation.REQUIRED },
    );

    if (!scriptContext.postCommitTasks) {
      this.genericEntityMutationService.schedulePostCommitTasks(
        postCommitTasks,
      );
    }
    return { action: 'deleted' };
  }

  private async deleteRelationChildren(
    reference: CascadeReference,
    parentHandle: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
    postCommitTasks: GenericPostCommitTask[],
    visitedRecords: Set<string>,
  ): Promise<void> {
    const entityClass = this.genericQueryService.getEntityClass(
      reference.entityHandle,
    );
    const children = await this.em.find(entityClass, {
      [reference.mappedBy]: parentHandle,
    });
    const childHandles = children
      .map((child) => this.extractHandle(child))
      .filter(
        (childHandle): childHandle is string | number => childHandle != null,
      )
      .sort((left, right) =>
        String(left).localeCompare(String(right), undefined, { numeric: true }),
      );

    for (const childHandle of childHandles) {
      await this.deleteRecordWithRequiredChildren(
        reference.entityHandle,
        childHandle,
        currentUser,
        scriptContext,
        postCommitTasks,
        visitedRecords,
      );
    }
  }

  private async deleteRecordWithRequiredChildren(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
    postCommitTasks: GenericPostCommitTask[],
    visitedRecords: Set<string>,
  ): Promise<void> {
    const recordKey = `${entityHandle}:${String(handle)}`;
    if (visitedRecords.has(recordKey)) return;
    visitedRecords.add(recordKey);

    for (const reference of this.getCascadeReferences(entityHandle)) {
      if (!reference.required || reference.databaseCascade) continue;
      await this.deleteRelationChildren(
        reference,
        this.genericReferenceService.normalizeHandleValue(entityHandle, handle),
        currentUser,
        scriptContext,
        postCommitTasks,
        visitedRecords,
      );
    }

    await this.genericEntityMutationService.delete(
      entityHandle,
      handle,
      currentUser,
      scriptContext,
      { postCommitTasks },
    );
  }

  private async assertDeleteAccess(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
  ): Promise<boolean> {
    const entityClass = this.genericQueryService.getEntityClass(entityHandle);
    const handleFilter = this.genericReferenceService.getHandleFilter(
      entityHandle,
      handle,
    );
    const visibleFilter =
      this.genericPermissionService.applyEntityVisibilityFilter(
        handleFilter,
        currentUser,
        entityHandle,
      );
    const item = await this.em.findOne(entityClass, visibleFilter);
    if (!item) {
      return false;
    }

    this.genericPermissionService.checkTopLevelPermission(
      entityHandle,
      item,
      currentUser,
      'allowDeleteStage',
    );
    return true;
  }

  private getCascadeReferences(entityHandle: string): CascadeReference[] {
    return this.getCascadeReferencesForTemplate(
      this.templateService.getEntityTemplate(entityHandle),
    )
      .map(({ template, mappedBy }) => {
        const owningRelation = this.getOwningRelation(
          template.referenceName,
          mappedBy,
        );
        const databaseCascade = owningRelation?.deleteRule === 'cascade';
        return {
          name: template.name,
          entityHandle: template.referenceName,
          kind: '1:m' as const,
          mappedBy,
          required: databaseCascade || owningRelation?.nullable === false,
          databaseCascade,
          hidden: template.options?.includes('isHideAsReference') ?? false,
        };
      })
      .filter((reference) => reference.required || !reference.hidden)
      .map((reference) => ({
        name: reference.name,
        entityHandle: reference.entityHandle,
        kind: reference.kind,
        mappedBy: reference.mappedBy,
        required: reference.required,
        databaseCascade: reference.databaseCascade,
      }));
  }

  private getOwningRelation(
    childEntityHandle: string,
    mappedBy: string,
  ): EntityTemplateDto | undefined {
    return this.templateService
      .getEntityTemplate(childEntityHandle)
      .find(
        (field) =>
          field.name === mappedBy &&
          field.isReference &&
          ['m:1', '1:1'].includes(field.kind ?? ''),
      );
  }

  private getCascadeReferencesForTemplate(template: EntityTemplateDto[]) {
    return template
      .filter(
        (field) =>
          field.isReference &&
          field.kind === '1:m' &&
          Boolean(field.referenceName) &&
          Boolean(field.mappedBy),
      )
      .map((field) => ({
        template: field,
        mappedBy: field.mappedBy as string,
      }));
  }

  private resolveSelectedReferences(
    entityHandle: string,
    relationNames: string[],
  ): CascadeReference[] {
    const available = new Map(
      this.getCascadeReferences(entityHandle)
        .filter((reference) => !reference.required)
        .map((reference) => [reference.name, reference]),
    );
    const normalizedNames = [
      ...new Set(relationNames.map((name) => name.trim()).filter(Boolean)),
    ];
    const invalidName = normalizedNames.find((name) => !available.has(name));
    if (invalidName) {
      throw new BadRequestException('global.invalidDeleteReference');
    }
    const mandatoryApplicationCascades = this.getCascadeReferences(
      entityHandle,
    ).filter((reference) => reference.required && !reference.databaseCascade);
    const selectedOptionalCascades = normalizedNames.map(
      (name) => available.get(name) as CascadeReference,
    );
    return [...mandatoryApplicationCascades, ...selectedOptionalCascades];
  }

  private extractHandle(item: unknown): string | number | null {
    if (!item || typeof item !== 'object' || !('handle' in item)) return null;
    const handle = (item as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
}
