import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { EntityItem } from '../../entity/EntityItem';
import { PersonItem } from '../../entity/PersonItem';
import { ChangeLogItem } from '../../entity/ChangeLogItem';
import { ChangeLogDetailItem } from '../../entity/ChangeLogDetailItem';
import { ChangeLogActionItem } from '../../entity/ChangeLogActionItem';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { ChangeLogResponseDto } from './dto/change-log-response.dto';
import { GenericSanitizerService } from './generic-sanitizer.service';
import { FieldPermissionService } from '../current/field-permission.service';
import {
  buildChangeLogDetails,
  extractChangeLogReference,
  normalizeChangeLogPayload,
  normalizeChangeLogValue,
  projectChangeLogPayload,
  type ChangeLogAction,
  type ChangeLogPayload,
} from './generic-change-log.util';

@Injectable()
export class GenericChangeLogService {
  constructor(
    private readonly em: EntityManager,
    private readonly genericSanitizerService: GenericSanitizerService,
    private readonly fieldPermissions: FieldPermissionService = {
      getTemplates: () => Promise.resolve([]),
      canAccessField: () => true,
    } as unknown as FieldPermissionService,
  ) {}

  async getRecordChangeLog(
    entityHandle: string,
    handle: string | number,
    currentUser?: PersonItem,
  ): Promise<ChangeLogResponseDto[]> {
    const items = await this.em.find(
      ChangeLogItem,
      {
        entity: { handle: entityHandle },
        reference: String(handle),
      },
      {
        populate: ['action', 'entity', 'person', 'details'],
        orderBy: { createdAt: 'DESC', handle: 'DESC' },
      },
    );

    const templates = currentUser
      ? await this.fieldPermissions.getTemplates(entityHandle)
      : [];
    const fieldsByName = new Map(templates.map((field) => [field.name, field]));

    return items.map((item) => {
      const response = new ChangeLogResponseDto();
      response.handle = item.handle ?? 0;
      response.action = item.action.handle as ChangeLogAction;
      response.reference = item.reference;
      response.entity = {
        handle: item.entity.handle,
        icon: item.entity.icon ?? null,
      };
      response.person = (
        currentUser
          ? this.genericSanitizerService.projectEntityResult(
              'person',
              item.person,
              currentUser,
            )
          : this.genericSanitizerService.sanitizeEntityResult(
              'person',
              item.person,
            )
      ) as ChangeLogResponseDto['person'];
      const oldPayload = normalizeChangeLogPayload(item.oldPayload);
      const newPayload = normalizeChangeLogPayload(item.newPayload);
      response.oldPayload = currentUser
        ? normalizeChangeLogPayload(
            this.genericSanitizerService.projectEntityResult(
              entityHandle,
              oldPayload,
              currentUser,
              templates,
            ),
          )
        : oldPayload;
      response.newPayload = currentUser
        ? normalizeChangeLogPayload(
            this.genericSanitizerService.projectEntityResult(
              entityHandle,
              newPayload,
              currentUser,
              templates,
            ),
          )
        : newPayload;
      response.details = [...item.details]
        .sort((left, right) => (left.handle ?? 0) - (right.handle ?? 0))
        .filter((detail) => {
          if (!currentUser) return true;
          const field = fieldsByName.get(detail.property);
          return (
            !!field &&
            this.fieldPermissions.canAccessField(
              currentUser,
              entityHandle,
              field,
              'read',
              newPayload ?? oldPayload,
              templates,
            )
          );
        })
        .map((detail) => ({
          property: detail.property,
          oldValue: normalizeChangeLogValue(detail.oldValue),
          newValue: normalizeChangeLogValue(detail.newValue),
        }));
      response.createdAt = item.createdAt ?? new Date();
      return response;
    });
  }

  async findLatestChange(
    entityHandle: string,
    handle: string | number,
  ): Promise<Record<string, unknown> | null> {
    try {
      const latestChange = await this.em.findOne(
        ChangeLogItem,
        {
          entity: { handle: entityHandle },
          reference: String(handle),
        },
        {
          populate: ['action', 'entity', 'person'],
          orderBy: { createdAt: 'DESC', handle: 'DESC' },
        },
      );

      if (!latestChange) {
        return null;
      }

      return {
        handle: latestChange.handle ?? null,
        action: latestChange.action?.handle ?? null,
        createdAt: latestChange.createdAt ?? null,
        person: this.genericSanitizerService.sanitizeEntityResult(
          'person',
          latestChange.person,
        ),
      };
    } catch (error) {
      global.log?.warn?.('updateConflict.latestChange:', error);
      return null;
    }
  }

  async safeStoreChangeLog(
    action: ChangeLogAction,
    entity: EntityItem | null,
    currentUser: PersonItem,
    oldPayload: ChangeLogPayload,
    newPayload: ChangeLogPayload,
  ): Promise<void> {
    try {
      await this.storeChangeLog(
        action,
        entity,
        currentUser,
        oldPayload,
        newPayload,
      );
    } catch (error) {
      global.log?.error?.('changeLog:', error);
    }
  }

  captureEntityChangeLogPayload(
    entityHandle: string,
    value: object,
    template: EntityTemplateDto[],
    shapeSource?: ChangeLogPayload,
  ): ChangeLogPayload {
    const sanitized = normalizeChangeLogPayload(
      this.genericSanitizerService.sanitizeEntityResult(
        entityHandle,
        value,
        template,
      ) as Record<string, unknown>,
    );

    return projectChangeLogPayload(template, sanitized, shapeSource);
  }

  captureSubmittedChangeLogPayload(
    template: EntityTemplateDto[],
    payload: Record<string, unknown> | null | undefined,
  ): ChangeLogPayload {
    if (!payload) {
      return null;
    }

    const normalized = normalizeChangeLogPayload({
      ...payload,
    });

    return projectChangeLogPayload(template, normalized);
  }

  withRecordReference(
    payload: ChangeLogPayload,
    reference: string | number | null,
  ): ChangeLogPayload {
    if (reference == null) {
      return payload;
    }

    return {
      ...(payload ?? {}),
      handle: reference,
    };
  }

  private async storeChangeLog(
    action: ChangeLogAction,
    entity: EntityItem | null,
    currentUser: PersonItem,
    oldPayload: ChangeLogPayload,
    newPayload: ChangeLogPayload,
  ): Promise<void> {
    if (
      !entity ||
      entity.handle == null ||
      currentUser.handle == null ||
      typeof this.em.create !== 'function' ||
      typeof this.em.flush !== 'function'
    ) {
      return;
    }

    const reference = extractChangeLogReference(newPayload ?? oldPayload);
    if (reference == null) {
      return;
    }

    const logEm = typeof this.em.fork === 'function' ? this.em.fork() : this.em;

    const actionEntity = await logEm.findOne(ChangeLogActionItem, {
      handle: action,
    });
    if (!actionEntity) {
      return;
    }

    const log = logEm.create(ChangeLogItem, {
      action: actionEntity.handle,
      reference: String(reference),
      entity: entity.handle,
      person: currentUser.handle,
      oldPayload,
      newPayload,
    } as any);
    const details = buildChangeLogDetails(action, oldPayload, newPayload);

    for (const detail of details) {
      log.details.add(
        logEm.create(ChangeLogDetailItem, {
          log,
          property: detail.property,
          oldValue: detail.oldValue,
          newValue: detail.newValue,
        }),
      );
    }

    await logEm.flush();
  }
}
