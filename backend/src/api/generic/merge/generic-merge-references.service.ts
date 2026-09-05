import { ConflictException, Injectable } from '@nestjs/common';
import {
  Collection,
  EntityManager,
  LockMode,
  ReferenceKind,
  type EntityMetadata,
  type EntityProperty,
} from '@mikro-orm/core';
import { ENTITY_REGISTRY } from '../../../entity/global/entity.registry';
import { PersonItem } from '../../../entity/PersonItem';
import type { ScriptServerContext } from '../../../script/core/script.interface';
import { TemplateService } from '../../template/template.service';
import {
  GenericEntityMutationService,
  type GenericPostCommitTask,
} from '../generic-entity-mutation.service';
import { GenericMergeAccessService } from './generic-merge-access.service';
import { GenericMergeSystemReferencesService } from './generic-merge-system-references.service';
import { GenericReferenceService } from '../generic-reference.service';
import { mergeHandle, type MergeRecord } from './generic-merge.util';

/** Discovers owning relations from the entire ORM model, including hidden/inverse UI relations. */
@Injectable()
export class GenericMergeReferencesService {
  constructor(
    private readonly em: EntityManager,
    private readonly templates: TemplateService,
    private readonly access: GenericMergeAccessService,
    private readonly mutations: GenericEntityMutationService,
    private readonly systemReferences: GenericMergeSystemReferencesService,
    private readonly referenceValidation: GenericReferenceService,
  ) {}

  async transfer(
    entity: string,
    loser: MergeRecord,
    winner: MergeRecord,
    user: PersonItem,
    context: ScriptServerContext,
    tasks: GenericPostCommitTask[],
    visited = new Set<string>(),
    changedRecords = new Map<
      string,
      { entity: string; handle: string | number }
    >(),
    effectActor: PersonItem = user,
  ): Promise<Map<string, { entity: string; handle: string | number }>> {
    const key = `${entity}:${loser.handle}`;
    if (visited.has(key))
      throw new ConflictException('recordMerge.referenceConflict');
    visited.add(key);
    const targetClass = ENTITY_REGISTRY.find(
      (entry) => entry.name === entity,
    )!.class;

    // Process each owning record once, combining all affected fields before
    // validation (e.g. an appointment's creator company and assignee company).
    for (const metadata of this.em.getMetadata().getAll().values()) {
      if (
        !metadata.class ||
        metadata.abstract ||
        metadata.pivotTable ||
        metadata.embeddable ||
        metadata.virtual
      )
        continue;
      const entityName = ENTITY_REGISTRY.find(
        (entry) => entry.class === metadata.class,
      )?.name;
      const incoming = metadata.props.filter(
        (property) =>
          property.targetMeta?.class === targetClass &&
          this.isOwningRelation(property),
      );
      const outgoing =
        metadata.class === targetClass
          ? metadata.props.filter(
              (property) =>
                property.kind === ReferenceKind.MANY_TO_MANY && property.owner,
            )
          : [];
      if (!incoming.length && !outgoing.length) continue;

      const filters = incoming.map((property) => ({
        [property.name]: loser.handle,
      }));
      if (outgoing.length) filters.push({ handle: winner.handle });
      const rows = (await this.em.find(
        metadata.class,
        { $or: filters },
        {
          lockMode: LockMode.PESSIMISTIC_WRITE,
          orderBy: { handle: 'ASC' },
        },
      )) as MergeRecord[];
      for (const row of rows) {
        if (metadata.class === targetClass && row.handle === loser.handle)
          continue;
        const changes: Record<string, unknown> = {};
        for (const property of incoming) {
          if (property.kind === ReferenceKind.MANY_TO_MANY) {
            const collection = row[property.name] as Collection<object>;
            await collection.init();
            const handles = collection.getItems().map(mergeHandle);
            if (handles.includes(loser.handle))
              changes[property.name] = [
                ...new Set(
                  handles.map((handle) =>
                    handle === loser.handle ? winner.handle : handle,
                  ),
                ),
              ];
          } else if (mergeHandle(row[property.name]) === loser.handle) {
            changes[property.name] = winner.handle;
          }
        }
        if (metadata.class === targetClass && row.handle === winner.handle) {
          await this.unionOutgoingCollections(
            outgoing,
            loser,
            row,
            targetClass,
            changes,
          );
        }
        if (!Object.keys(changes).length) continue;
        if (!entityName)
          throw new ConflictException('recordMerge.referenceConflict');
        await this.access.assertRelationAccess(
          entityName,
          row,
          changes,
          user,
          this.templates.getEntityTemplate(entityName),
        );
        await this.assertUniqueRelations(metadata, row, changes);
        await this.mutations.update(
          entityName,
          row.handle,
          changes,
          user,
          [],
          context,
          {},
          {
            postCommitTasks: tasks,
            deferReferenceValidation: true,
            identityReferenceFields: Object.keys(changes),
            effectActor,
          },
        );
        changedRecords.set(`${entityName}:${row.handle}`, {
          entity: entityName,
          handle: row.handle,
        });
      }
    }

    await this.systemReferences.transfer(
      entity,
      loser,
      winner,
      async (childEntity, childLoser, childWinner) => {
        await this.transfer(
          childEntity,
          childLoser,
          childWinner,
          user,
          context,
          tasks,
          visited,
          changedRecords,
          effectActor,
        );
      },
    );
    return changedRecords;
  }

  async validate(
    changedRecords: Map<string, { entity: string; handle: string | number }>,
    user: PersonItem,
  ): Promise<void> {
    for (const { entity, handle } of changedRecords.values()) {
      const entityClass = ENTITY_REGISTRY.find(
        (entry) => entry.name === entity,
      )!.class;
      const record = await this.em.findOne(
        entityClass,
        { handle },
        { refresh: true },
      );
      // Consolidated auxiliary records may themselves have been merged away.
      if (!record) continue;
      await this.referenceValidation.validateReferenceDependencies(
        entity,
        record,
        this.templates.getEntityTemplate(entity),
        user,
      );
    }
  }

  private isOwningRelation(property: EntityProperty): boolean {
    return (
      property.kind === ReferenceKind.MANY_TO_ONE ||
      ((property.kind === ReferenceKind.ONE_TO_ONE ||
        property.kind === ReferenceKind.MANY_TO_MANY) &&
        property.owner)
    );
  }

  async assertNoReferences(entity: string, loser: MergeRecord): Promise<void> {
    const targetClass = ENTITY_REGISTRY.find(
      (entry) => entry.name === entity,
    )!.class;
    for (const metadata of this.em.getMetadata().getAll().values()) {
      if (!metadata.class || metadata.abstract || metadata.pivotTable) continue;
      const properties = metadata.props.filter(
        (property) =>
          property.targetMeta?.class === targetClass &&
          this.isOwningRelation(property),
      );
      if (!properties.length) continue;
      const where = {
        $or: properties.map((property) => ({ [property.name]: loser.handle })),
        ...(metadata.class === targetClass
          ? { handle: { $ne: loser.handle } }
          : {}),
      };
      if (await this.em.count(metadata.class, where))
        throw new ConflictException('recordMerge.referencesChanged');
    }
    await this.systemReferences.assertNoReferences(entity, loser.handle);
  }

  private async unionOutgoingCollections(
    properties: EntityProperty[],
    loser: MergeRecord,
    winner: MergeRecord,
    targetClass: unknown,
    changes: Record<string, unknown>,
  ): Promise<void> {
    for (const property of properties) {
      const source = loser[property.name] as Collection<object>;
      const target = winner[property.name] as Collection<object>;
      await source.init();
      await target.init();
      const handles = [...target.getItems(), ...source.getItems()]
        .map(mergeHandle)
        .map((handle) =>
          property.targetMeta?.class === targetClass && handle === loser.handle
            ? winner.handle
            : handle,
        );
      const union = [...new Set(handles)];
      const existing = target.getItems().map(mergeHandle);
      if (
        union.length !== existing.length ||
        union.some((handle) => !existing.includes(handle))
      ) {
        changes[property.name] = union;
      }
    }
  }

  private async assertUniqueRelations(
    metadata: EntityMetadata,
    row: MergeRecord,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const constraints = [
      ...metadata.props
        .filter((property) => property.unique)
        .map((property) => [property.name]),
      ...metadata.uniques.map((unique) =>
        typeof unique.properties === 'string'
          ? [unique.properties]
          : (unique.properties ?? []),
      ),
    ];
    for (const properties of constraints) {
      if (!properties.some((name) => name in changes)) continue;
      const where: Record<string, unknown> = { handle: { $ne: row.handle } };
      for (const name of properties) {
        const value = name in changes ? changes[name] : row[name];
        where[name] = metadata.properties[name]?.targetMeta
          ? mergeHandle(value)
          : value;
      }
      // PostgreSQL normally permits repeated NULLs in a unique key.
      if (properties.some((name) => where[name] == null)) continue;
      if (await this.em.count(metadata.class, where)) {
        throw new ConflictException('recordMerge.referenceConflict');
      }
    }
  }
}
