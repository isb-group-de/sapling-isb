import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, TransactionPropagation } from '@mikro-orm/core';
import { EventAzureItem } from '../../entity/EventAzureItem';
import { EventDeliveryItem } from '../../entity/EventDeliveryItem';
import { EventGoogleItem } from '../../entity/EventGoogleItem';
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

type CascadeReference = GenericDeleteReferenceDto & { mappedBy: string };

/** Coordinates delete previews, selected child cascades, and Event cancellation. */
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
    await this.assertDeleteAccess(entityHandle, handle, currentUser);

    if (await this.isSynchronizedEvent(entityHandle, handle)) {
      return { action: 'cancel', references: [] };
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
    await this.assertDeleteAccess(entityHandle, handle, currentUser);

    if (await this.isSynchronizedEvent(entityHandle, handle)) {
      await this.genericEntityMutationService.update(
        'event',
        handle,
        { status: 'canceled' },
        currentUser,
        [],
        scriptContext,
        { resolution: 'overwrite' },
      );
      return { action: 'canceled' };
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
      );
      return { action: 'deleted' };
    }

    const postCommitTasks: GenericPostCommitTask[] = [];
    const normalizedParentHandle =
      this.genericReferenceService.normalizeHandleValue(entityHandle, handle);
    const transactionalContext: ScriptServerContext = {
      ...scriptContext,
      postCommitTasks,
    };

    await this.em.transactional(
      async () => {
        for (const reference of selectedReferences) {
          await this.deleteRelationChildren(
            reference,
            normalizedParentHandle,
            currentUser,
            transactionalContext,
            postCommitTasks,
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

    this.genericEntityMutationService.schedulePostCommitTasks(postCommitTasks);
    return { action: 'deleted' };
  }

  private async deleteRelationChildren(
    reference: CascadeReference,
    parentHandle: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
    postCommitTasks: GenericPostCommitTask[],
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
      if (await this.isSynchronizedEvent(reference.entityHandle, childHandle)) {
        throw new ConflictException('global.syncedEventBlocksCascadeDelete');
      }

      await this.genericEntityMutationService.delete(
        reference.entityHandle,
        childHandle,
        currentUser,
        scriptContext,
        { postCommitTasks },
      );
    }
  }

  private async assertDeleteAccess(
    entityHandle: string,
    handle: string | number,
    currentUser: PersonItem,
  ): Promise<void> {
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
      throw new NotFoundException('global.entityNotFound');
    }

    this.genericPermissionService.checkTopLevelPermission(
      entityHandle,
      item,
      currentUser,
      'allowDeleteStage',
    );
  }

  private getCascadeReferences(entityHandle: string): CascadeReference[] {
    return this.getCascadeReferencesForTemplate(
      this.templateService.getEntityTemplate(entityHandle),
    )
      .map(({ template, mappedBy }) => ({
        name: template.name,
        entityHandle: template.referenceName,
        kind: '1:m' as const,
        mappedBy,
        required: this.hasDatabaseDeleteCascade(
          template.referenceName,
          mappedBy,
        ),
        hidden: template.options?.includes('isHideAsReference') ?? false,
      }))
      .filter((reference) => reference.required || !reference.hidden)
      .map((reference) => ({
        name: reference.name,
        entityHandle: reference.entityHandle,
        kind: reference.kind,
        mappedBy: reference.mappedBy,
        required: reference.required,
      }));
  }

  private hasDatabaseDeleteCascade(
    childEntityHandle: string,
    mappedBy: string,
  ): boolean {
    const owningRelation = this.templateService
      .getEntityTemplate(childEntityHandle)
      .find(
        (field) =>
          field.name === mappedBy &&
          field.isReference &&
          ['m:1', '1:1'].includes(field.kind ?? ''),
      );

    return owningRelation?.deleteRule === 'cascade';
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
    return normalizedNames.map(
      (name) => available.get(name) as CascadeReference,
    );
  }

  private async isSynchronizedEvent(
    entityHandle: string,
    handle: string | number,
  ): Promise<boolean> {
    if (entityHandle !== 'event') return false;
    const normalizedHandle = this.genericReferenceService.normalizeHandleValue(
      'event',
      handle,
    );
    const [azure, google, delivery] = await Promise.all([
      this.em.findOne(EventAzureItem, { event: normalizedHandle } as never),
      this.em.findOne(EventGoogleItem, { event: normalizedHandle } as never),
      this.em.findOne(EventDeliveryItem, { event: normalizedHandle } as never),
    ]);
    return Boolean(azure || google || delivery);
  }

  private extractHandle(item: unknown): string | number | null {
    if (!item || typeof item !== 'object' || !('handle' in item)) return null;
    const handle = (item as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
}
