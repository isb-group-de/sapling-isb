import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PersonItem } from '../../entity/PersonItem';
import { TemplateService } from '../template/template.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { GenericPayloadService } from './generic-payload.service';
import { GenericPermissionService } from './generic-permission.service';
import { GenericQueryService } from './generic-query.service';
import { GenericReferenceService } from './generic-reference.service';
import { FieldPermissionService } from '../current/field-permission.service';

export interface InlineCollectionMutation {
  field: EntityTemplateDto;
  items: Record<string, unknown>[];
}

/** Extracts and synchronizes inline 1:m collections embedded in CRUD payloads. */
@Injectable()
export class GenericInlineCollectionService {
  constructor(
    private readonly em: EntityManager,
    private readonly templateService: TemplateService,
    private readonly genericQueryService: GenericQueryService,
    private readonly genericReferenceService: GenericReferenceService,
    private readonly genericPermissionService: GenericPermissionService,
    private readonly genericPayloadService: GenericPayloadService,
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: (entityHandle: string) =>
        Promise.resolve(this.templateService.getEntityTemplate(entityHandle)),
      assertPayloadAccess: () => Promise.resolve(),
    } as unknown as FieldPermissionService,
  ) {}

  extractPayload(
    template: EntityTemplateDto[],
    data: Record<string, unknown>,
  ): InlineCollectionMutation[] {
    return template
      .filter((field) => field.inlineCollection)
      .map((field) => {
        if (!Object.prototype.hasOwnProperty.call(data, field.name)) {
          return null;
        }

        const value = data[field.name];
        delete data[field.name];

        if (!Array.isArray(value)) {
          throw new BadRequestException('global.invalidPayload');
        }

        return {
          field,
          items: value.filter(this.isPlainRecord),
        } satisfies InlineCollectionMutation;
      })
      .filter(
        (mutation): mutation is InlineCollectionMutation => mutation !== null,
      );
  }

  async sync(
    entityHandle: string,
    owner: object,
    mutations: InlineCollectionMutation[],
    currentUser: PersonItem,
  ): Promise<void> {
    if (mutations.length === 0) {
      return;
    }

    const ownerHandle = this.extractEntityHandle(owner);
    if (ownerHandle == null) {
      throw new BadRequestException('global.invalidPayload');
    }

    for (const mutation of mutations) {
      await this.syncCollection(
        entityHandle,
        ownerHandle,
        mutation,
        currentUser,
      );
    }

    await this.em.flush();
  }

  private async syncCollection(
    entityHandle: string,
    ownerHandle: string | number,
    mutation: InlineCollectionMutation,
    currentUser: PersonItem,
  ): Promise<void> {
    const { field } = mutation;
    const referenceEntityHandle = field.referenceName;
    const mappedBy = field.mappedBy;

    if (!referenceEntityHandle || !mappedBy || field.kind !== '1:m') {
      throw new BadRequestException(
        `Inline collection ${entityHandle}.${field.name} must be a 1:m relation with mappedBy metadata.`,
      );
    }

    const referenceClass = this.genericQueryService.getEntityClass(
      referenceEntityHandle,
    );
    const referenceTemplate = this.templateService.getEntityTemplate(
      referenceEntityHandle,
    );
    const referencePermissionTemplate =
      await this.fieldPermissions.getTemplates(referenceEntityHandle);
    const existingItems = await this.em.find(referenceClass, {
      [mappedBy]: ownerHandle,
    });
    const existingByHandle = new Map(
      existingItems
        .map((item) => [this.extractEntityHandle(item), item] as const)
        .filter(([handle]) => handle != null)
        .map(([handle, item]) => [String(handle), item] as const),
    );
    const touchedHandles = new Set<string>();

    for (const [index, item] of mutation.items.entries()) {
      const handle = this.extractEntityHandle(item);
      const normalizedHandle =
        handle == null
          ? null
          : this.genericReferenceService.normalizeHandleValue(
              referenceEntityHandle,
              handle,
            );
      const existing =
        normalizedHandle == null
          ? null
          : existingByHandle.get(String(normalizedHandle));
      const payload = this.buildItemPayload(
        referenceTemplate,
        mappedBy,
        ownerHandle,
        item,
        index,
      );
      const submittedPayload = { ...item };
      delete submittedPayload.handle;

      if (existing) {
        await this.fieldPermissions.assertPayloadAccess(
          currentUser,
          referenceEntityHandle,
          submittedPayload,
          'update',
          { ...(existing as Record<string, unknown>), ...submittedPayload },
          referencePermissionTemplate,
        );
        touchedHandles.add(String(normalizedHandle));
        this.genericPermissionService.checkTopLevelPermission(
          referenceEntityHandle,
          { ...(existing as Record<string, unknown>), ...payload },
          currentUser,
          'allowUpdateStage',
        );
        this.em.assign(
          existing,
          this.genericPayloadService.prepareUpdatePayload(
            referenceTemplate,
            payload,
          ) as never,
        );
        continue;
      }

      await this.fieldPermissions.assertPayloadAccess(
        currentUser,
        referenceEntityHandle,
        submittedPayload,
        'insert',
        submittedPayload,
        referencePermissionTemplate,
      );
      this.genericPermissionService.checkTopLevelPermission(
        referenceEntityHandle,
        payload,
        currentUser,
        'allowInsertStage',
      );
      this.em.create(
        referenceClass,
        this.genericPayloadService.prepareCreatePayload(
          referenceTemplate,
          payload,
        ) as never,
      );
    }

    existingByHandle.forEach((item, handle) => {
      if (touchedHandles.has(handle)) {
        return;
      }

      this.genericPermissionService.checkTopLevelPermission(
        referenceEntityHandle,
        item,
        currentUser,
        'allowDeleteStage',
      );
      this.em.remove(item);
    });
  }

  private buildItemPayload(
    referenceTemplate: EntityTemplateDto[],
    mappedBy: string,
    ownerHandle: string | number,
    item: Record<string, unknown>,
    index: number,
  ): Record<string, unknown> {
    const payload = { ...item, [mappedBy]: ownerHandle };
    delete payload.handle;

    if (
      referenceTemplate.some((field) => field.name === 'sortOrder') &&
      payload.sortOrder == null
    ) {
      payload.sortOrder = index;
    }

    return payload;
  }

  private isPlainRecord(
    this: void,
    value: unknown,
  ): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractEntityHandle(item: object): string | number | null {
    const handle = (item as { handle?: unknown }).handle;
    return typeof handle === 'string' || typeof handle === 'number'
      ? handle
      : null;
  }
}
