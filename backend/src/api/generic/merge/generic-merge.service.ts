import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  DriverException,
  EntityManager,
  IsolationLevel,
  TransactionPropagation,
} from '@mikro-orm/core';
import { PersonItem } from '../../../entity/PersonItem';
import type { ScriptServerContext } from '../../../script/core/script.interface';
import { FieldPermissionService } from '../../current/field-permission.service';
import { GenericCustomFieldService } from '../generic-custom-field.service';
import {
  GenericEntityMutationService,
  type GenericPostCommitTask,
} from '../generic-entity-mutation.service';
import { GenericQueryService } from '../generic-query.service';
import { GenericSanitizerService } from '../generic-sanitizer.service';
import { GenericMergeAccessService } from './generic-merge-access.service';
import { GenericMergeReferencesService } from './generic-merge-references.service';
import { GenericMergeSystemReferencesService } from './generic-merge-system-references.service';
import type {
  GenericMergeDto,
  GenericMergePairDto,
  GenericMergePreview,
  GenericMergeResult,
} from './generic-merge.dto';
import {
  isEmptyMergeValue,
  isMergeValueField,
  mergeFieldValue,
  mergeHandle,
  mergeRecordSnapshot,
  mergeSnapshotToken,
  type MergeRecord,
} from './generic-merge.util';

/** Resolves field choices from server snapshots and commits a complete identity merge. */
@Injectable()
export class GenericMergeService {
  constructor(
    private readonly em: EntityManager,
    private readonly query: GenericQueryService,
    private readonly access: GenericMergeAccessService,
    private readonly fields: FieldPermissionService,
    private readonly customFields: GenericCustomFieldService,
    private readonly sanitizer: GenericSanitizerService,
    private readonly references: GenericMergeReferencesService,
    private readonly systemReferences: GenericMergeSystemReferencesService,
    private readonly mutations: GenericEntityMutationService,
  ) {}

  async preview(
    entity: string,
    pair: GenericMergePairDto,
    user: PersonItem,
  ): Promise<GenericMergePreview> {
    const { loser, winner } = await this.loadPair(entity, pair, user, false);
    return this.buildPreview(entity, loser, winner, user);
  }

  async merge(
    entity: string,
    request: GenericMergeDto,
    user: PersonItem,
    scriptContext: ScriptServerContext,
  ): Promise<GenericMergeResult> {
    const tasks: GenericPostCommitTask[] = [];
    const context = { ...scriptContext, postCommitTasks: tasks };
    const result = await this.em
      .transactional(
        async () => {
          const { loser, winner } = await this.loadPair(
            entity,
            request,
            user,
            true,
          );
          const preview = await this.buildPreview(entity, loser, winner, user);
          if (request.previewToken !== preview.previewToken)
            throw new ConflictException('recordMerge.stalePreview');
          const changes = this.resolveSelections(
            entity,
            request,
            preview,
            loser,
            winner,
          );
          await this.fields.assertPayloadAccess(
            user,
            entity,
            changes,
            'update',
            {
              ...winner,
              ...changes,
            },
          );
          this.access.assertRecordAccess(
            entity,
            { ...winner, ...changes },
            user,
            'update',
          );

          const effectActor =
            entity === 'person' && user.handle === loser.handle
              ? (winner as unknown as PersonItem)
              : user;
          const changedRecords = await this.references.transfer(
            entity,
            loser,
            winner,
            user,
            context,
            tasks,
            new Set(),
            new Map(),
            effectActor,
          );
          // Delete only after every relationship was transferred. Deleting before
          // the final field update releases unique values owned by the loser.
          await this.mutations.delete(entity, loser.handle, user, context, {
            postCommitTasks: tasks,
            mergeTargetHandle: winner.handle,
            effectActor,
            assertDeleteIntegrity: () =>
              this.references.assertNoReferences(entity, loser),
          });
          const updated = await this.mutations.update(
            entity,
            winner.handle,
            changes,
            user,
            [],
            context,
            {},
            { postCommitTasks: tasks, effectActor },
          );
          await this.references.validate(changedRecords, user);
          await this.systemReferences.assertNoReferences(entity, loser.handle);
          return { winner: updated, deletedHandle: loser.handle };
        },
        {
          propagation: TransactionPropagation.REQUIRED,
          isolationLevel: IsolationLevel.SERIALIZABLE,
        },
      )
      .catch((error: unknown) => {
        if (error instanceof DriverException) {
          if (['40001', '40P01'].includes(error.code ?? '')) {
            throw new ConflictException('recordMerge.stalePreview');
          }
          if (['23505', '23503'].includes(error.code ?? '')) {
            throw new ConflictException('recordMerge.referenceConflict');
          }
        }
        throw error;
      });
    this.mutations.schedulePostCommitTasks(tasks);
    return result;
  }

  private async loadPair(
    entity: string,
    pair: GenericMergePairDto,
    user: PersonItem,
    lock: boolean,
  ) {
    this.access.assertEntityAccess(entity, user);
    this.query.getEntityClass(entity);
    if (!pair.loserHandle || !pair.winnerHandle)
      throw new BadRequestException('recordMerge.invalidPair');
    const handles = [pair.loserHandle, pair.winnerHandle].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    const records: MergeRecord[] = [];
    for (const handle of handles)
      records.push(await this.access.loadRecord(entity, handle, user, lock));
    if (records[0].handle === records[1].handle)
      throw new BadRequestException('recordMerge.invalidPair');
    const loser = records[handles.indexOf(pair.loserHandle)];
    const winner = records[handles.indexOf(pair.winnerHandle)];
    this.access.assertRecordAccess(entity, loser, user, 'delete');
    this.access.assertRecordAccess(entity, winner, user, 'update');
    await this.customFields.hydrateRecords(entity, [loser, winner]);
    return { loser, winner };
  }

  private async buildPreview(
    entity: string,
    loser: MergeRecord,
    winner: MergeRecord,
    user: PersonItem,
  ): Promise<GenericMergePreview> {
    const templates = await this.fields.getTemplates(entity);
    const metadata = this.em
      .getMetadata()
      .get(this.query.getEntityClass(entity));
    const project = (record: MergeRecord) =>
      this.sanitizer.projectEntityResult(
        entity,
        mergeRecordSnapshot(metadata, record),
        user,
        templates,
      );
    const projectedLoser = project(loser);
    const projectedWinner = project(winner);
    return {
      loser: projectedLoser,
      winner: projectedWinner,
      previewToken: mergeSnapshotToken(
        entity,
        this.em.getMetadata().get(this.query.getEntityClass(entity)),
        loser,
        winner,
      ),
      fields: templates
        .filter(
          (field) =>
            isMergeValueField(field) &&
            this.fields.canAccessField(
              user,
              entity,
              field,
              'read',
              loser,
              templates,
            ) &&
            this.fields.canAccessField(
              user,
              entity,
              field,
              'read',
              winner,
              templates,
            ),
        )
        .map((field) => {
          const loserValue = mergeFieldValue(projectedLoser, field);
          const winnerValue = mergeFieldValue(projectedWinner, field);
          const selectable =
            !field.options?.includes('isSystem') &&
            this.fields.canAccessField(
              user,
              entity,
              field,
              'update',
              winner,
              templates,
            );
          return {
            property: field.name,
            template: field,
            loserValue,
            winnerValue,
            selectable,
            selectedSource:
              selectable &&
              isEmptyMergeValue(winnerValue) &&
              !isEmptyMergeValue(loserValue)
                ? 'loser'
                : 'winner',
          };
        }),
    };
  }

  private resolveSelections(
    entity: string,
    request: GenericMergeDto,
    preview: GenericMergePreview,
    loser: MergeRecord,
    winner: MergeRecord,
  ): Record<string, unknown> {
    if (!request.selections || Array.isArray(request.selections))
      throw new BadRequestException('recordMerge.invalidSelection');
    const byName = new Map(
      preview.fields.map((field) => [field.property, field]),
    );
    for (const [property, source] of Object.entries(request.selections)) {
      const field = byName.get(property);
      if (!field?.selectable || !['loser', 'winner'].includes(source))
        throw new BadRequestException('recordMerge.invalidSelection');
    }
    const changes: Record<string, unknown> = {};
    for (const field of preview.fields) {
      if (!field.selectable) continue;
      const source = request.selections[field.property] ?? field.selectedSource;
      // Explicitly write selectable custom values after consolidating their
      // storage rows, including an intentionally empty winner value.
      if (source !== 'loser' && !field.property.startsWith('customFields.'))
        continue;
      let value = mergeFieldValue(
        source === 'loser' ? loser : winner,
        field.template,
      );
      if (field.template.isReference) {
        value = mergeHandle(value);
        if (field.template.referenceName === entity && value === loser.handle)
          value = winner.handle;
      }
      changes[field.property] = value;
    }
    return changes;
  }
}
