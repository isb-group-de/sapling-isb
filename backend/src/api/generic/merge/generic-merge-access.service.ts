import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { GenericPermissionGuard } from '../../../auth/guard/generic-permission.guard';
import { PersonItem } from '../../../entity/PersonItem';
import { CurrentService } from '../../current/current.service';
import { FieldPermissionService } from '../../current/field-permission.service';
import type { EntityTemplateDto } from '../../template/dto/entity-template.dto';
import { GenericPermissionService } from '../generic-permission.service';
import { GenericQueryService } from '../generic-query.service';
import { GenericReferenceService } from '../generic-reference.service';
import { identityReferenceTemplates } from '../generic-reference-identity.util';
import type { MergeRecord } from './generic-merge.util';

/** Merge authorization is enforced independently of HTTP method permissions. */
@Injectable()
export class GenericMergeAccessService {
  constructor(
    private readonly em: EntityManager,
    private readonly current: CurrentService,
    private readonly permissions: GenericPermissionService,
    private readonly fields: FieldPermissionService,
    private readonly query: GenericQueryService,
    private readonly references: GenericReferenceService,
    private readonly guard: GenericPermissionGuard,
  ) {}

  assertEntityAccess(entityHandle: string, user: PersonItem): void {
    const permission = this.current.getEntityPermissions(user, entityHandle);
    if (
      !permission.allowRead ||
      !permission.allowUpdate ||
      !permission.allowDelete
    ) {
      throw new ForbiddenException('global.permissionDenied');
    }
  }

  async loadRecord(
    entityHandle: string,
    handle: string | number,
    user: PersonItem,
    lock: boolean,
  ): Promise<MergeRecord> {
    const entityClass = this.query.getEntityClass(entityHandle);
    const where = this.permissions.setTopLevelFilter(
      this.references.getHandleFilter(entityHandle, handle),
      user,
      entityHandle,
    );
    const item = await this.em.findOne(entityClass, where, {
      ...(lock ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {}),
      refresh: true,
    });
    if (!item) throw new NotFoundException('global.entityNotFound');
    return item as MergeRecord;
  }

  assertRecordAccess(
    entityHandle: string,
    record: MergeRecord,
    user: PersonItem,
    action: 'update' | 'delete',
  ): void {
    this.permissions.checkTopLevelPermission(
      entityHandle,
      { ...record },
      user,
      action === 'update' ? 'allowUpdateStage' : 'allowDeleteStage',
    );
  }

  async assertRelationAccess(
    entityHandle: string,
    record: MergeRecord,
    changes: Record<string, unknown>,
    user: PersonItem,
    templates: EntityTemplateDto[],
  ): Promise<void> {
    templates = identityReferenceTemplates(templates, Object.keys(changes));
    const permission = this.current.getEntityPermissions(user, entityHandle);
    if (!permission.allowRead || !permission.allowUpdate) {
      throw new ForbiddenException('recordMerge.referencePermissionDenied');
    }
    // Keep special generic restrictions (e.g. administrator-only entities)
    // when updating a relation internally, without a second HTTP request.
    for (const action of ['allowRead', 'allowUpdate'] as const) {
      await this.guard.assertPermissionForRequest(
        { method: 'PATCH', params: { entityHandle }, body: changes, user },
        { entityHandle, permission: action },
      );
    }
    // Check the old and resulting scopes; merging must not move another user's data.
    const visible = this.permissions.setTopLevelFilter(
      { handle: record.handle },
      user,
      entityHandle,
    );
    if (
      !(await this.em.count(this.query.getEntityClass(entityHandle), visible))
    ) {
      throw new ForbiddenException('recordMerge.referencePermissionDenied');
    }
    this.assertRecordAccess(entityHandle, record, user, 'update');
    this.assertRecordAccess(
      entityHandle,
      { ...record, ...changes },
      user,
      'update',
    );
    await this.fields.assertPayloadAccess(
      user,
      entityHandle,
      changes,
      'update',
      record,
      templates,
    );
    await this.fields.assertPayloadAccess(
      user,
      entityHandle,
      changes,
      'update',
      { ...record, ...changes },
      templates,
    );
  }
}
