import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import type { ScriptServerContext } from '../../script/core/script.interface';
import { ScriptMethods } from '../script/script.service';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericMutationService } from './generic-mutation.service';
import { GenericOpenTaskEventsService } from './generic-open-task-events.service';
import { GenericRelationService } from './generic-relation.service';
import { GenericSanitizerService } from './generic-sanitizer.service';
import { FieldPermissionService } from '../current/field-permission.service';

type RelationMutationContext = Awaited<
  ReturnType<GenericRelationService['addReferenceAndFlush']>
>;

type RelationMutationAction = 'create' | 'delete';

/** Executes relation mutations and their owning-record script lifecycle. */
@Injectable()
export class GenericRelationMutationService {
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericRelationService: GenericRelationService,
    private readonly genericMutationService: GenericMutationService,
    private readonly genericOpenTaskEventsService: GenericOpenTaskEventsService,
    private readonly genericSanitizerService: GenericSanitizerService,
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(this.templateService.getEntityTemplate(entityHandle)),
      assertPayloadAccess: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
  ) {}

  createReference(
    entityHandle: string,
    referenceName: string,
    entityHandleValue: string | number,
    referenceHandleValue: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<object> {
    return this.mutateReference(
      'create',
      entityHandle,
      referenceName,
      entityHandleValue,
      referenceHandleValue,
      currentUser,
      scriptContext,
    );
  }

  deleteReference(
    entityHandle: string,
    referenceName: string,
    entityHandleValue: string | number,
    referenceHandleValue: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<object> {
    return this.mutateReference(
      'delete',
      entityHandle,
      referenceName,
      entityHandleValue,
      referenceHandleValue,
      currentUser,
      scriptContext,
    );
  }

  private async mutateReference(
    action: RelationMutationAction,
    entityHandle: string,
    referenceName: string,
    entityHandleValue: string | number,
    referenceHandleValue: string | number,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<object> {
    const permissionTemplate =
      await this.fieldPermissions.getTemplates(entityHandle);
    await this.fieldPermissions.assertPayloadAccess(
      currentUser,
      entityHandle,
      { [referenceName]: referenceHandleValue },
      'update',
      undefined,
      permissionTemplate,
    );
    const previousOpenTaskUserHandles =
      await this.genericOpenTaskEventsService.loadReferenceUserHandles(
        entityHandle,
        referenceName,
        entityHandleValue,
      );
    const entity = await this.em.findOne(EntityItem, { handle: entityHandle });
    const mutation = await this.executeMutation(
      action,
      entityHandle,
      referenceName,
      entityHandleValue,
      referenceHandleValue,
      currentUser,
    );
    let newData = mutation.item;

    if (entity) {
      const overwrittenData =
        await this.genericMutationService.applyAfterScript(
          action === 'create'
            ? ScriptMethods.addReference
            : ScriptMethods.deleteReference,
          newData,
          entity,
          currentUser,
          {
            ...scriptContext,
            referenceName,
            referenceItems: [mutation.referenceItem],
          },
        );

      if (overwrittenData !== newData) {
        newData = (await this.genericMutationService.assignAndFlush(
          entityHandle,
          newData,
          overwrittenData,
          mutation.template,
        )) as Record<string, unknown>;
      }
    }

    const ownerUpdate = await this.triggerOwningRelationAfterUpdate(
      entityHandle,
      entity,
      mutation,
      currentUser,
      scriptContext,
    );
    if (ownerUpdate?.entityHandle === entityHandle) {
      newData = ownerUpdate.item;
    }

    await this.genericOpenTaskEventsService.emitReferenceCountChanges(
      entityHandle,
      referenceName,
      entityHandleValue,
      previousOpenTaskUserHandles,
    );

    return this.genericSanitizerService.projectEntityResult(
      entityHandle,
      newData,
      currentUser,
      permissionTemplate,
    );
  }

  private executeMutation(
    action: RelationMutationAction,
    entityHandle: string,
    referenceName: string,
    entityHandleValue: string | number,
    referenceHandleValue: string | number,
    currentUser: PersonItem,
  ): Promise<RelationMutationContext> {
    return action === 'create'
      ? this.genericRelationService.addReferenceAndFlush(
          entityHandle,
          referenceName,
          entityHandleValue,
          referenceHandleValue,
          currentUser,
        )
      : this.genericRelationService.deleteReferenceAndFlush(
          entityHandle,
          referenceName,
          entityHandleValue,
          referenceHandleValue,
          currentUser,
        );
  }

  private async triggerOwningRelationAfterUpdate(
    entityHandle: string,
    entity: EntityItem | null,
    mutation: RelationMutationContext,
    currentUser: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<{ entityHandle: string; item: Record<string, unknown> } | null> {
    const ownerContext = await this.resolveOwningRelationUpdateContext(
      entityHandle,
      entity,
      mutation,
    );
    if (!ownerContext?.entity) {
      return null;
    }

    ownerContext.item.updatedAt = new Date();
    await this.em.flush();

    const overwrittenData = await this.genericMutationService.applyAfterScript(
      ScriptMethods.afterUpdate,
      ownerContext.item,
      ownerContext.entity,
      currentUser,
      {
        ...scriptContext,
        referenceName: ownerContext.referenceName,
        referenceItems: ownerContext.referenceItems,
        currentItems: [ownerContext.item],
      },
    );

    let persistedItem = ownerContext.item;
    if (overwrittenData !== ownerContext.item) {
      persistedItem = (await this.genericMutationService.assignAndFlush(
        ownerContext.entityHandle,
        ownerContext.item,
        overwrittenData,
        ownerContext.template,
      )) as Record<string, unknown>;
    }

    return { entityHandle: ownerContext.entityHandle, item: persistedItem };
  }

  private async resolveOwningRelationUpdateContext(
    entityHandle: string,
    entity: EntityItem | null,
    mutation: RelationMutationContext,
  ): Promise<{
    entity: EntityItem | null;
    entityHandle: string;
    item: Record<string, unknown>;
    referenceItems: object[];
    referenceName: string;
    template: EntityTemplateDto[];
  } | null> {
    const { field } = mutation;
    if (!field.isReference) {
      return null;
    }

    if (field.kind === '1:m' || field.kind === 'm:n') {
      return {
        entity,
        entityHandle,
        item: mutation.item,
        referenceItems: [mutation.referenceItem],
        referenceName: field.name,
        template: mutation.template,
      };
    }

    if (field.kind !== 'n:m') {
      return null;
    }

    const ownerReferenceName = field.mappedBy ?? field.inversedBy ?? null;
    if (!ownerReferenceName) {
      return null;
    }

    return {
      entity: await this.em.findOne(EntityItem, {
        handle: mutation.referenceEntityHandle,
      }),
      entityHandle: mutation.referenceEntityHandle,
      item: mutation.referenceItem as Record<string, unknown>,
      referenceItems: [mutation.item],
      referenceName: ownerReferenceName,
      template: this.templateService.getEntityTemplate(
        mutation.referenceEntityHandle,
      ),
    };
  }
}
