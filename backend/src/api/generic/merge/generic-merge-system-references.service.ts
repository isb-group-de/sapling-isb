import { Injectable, ConflictException } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { CustomFieldValueItem } from '../../../entity/CustomFieldValueItem';
import { InformationItem } from '../../../entity/InformationItem';
import { AiVectorDocumentItem } from '../../../entity/AiVectorDocumentItem';
import { GlobalSearchIndexItem } from '../../../entity/GlobalSearchIndexItem';
import { getSaplingGenericReference } from '../../../entity/global/entity.decorator';
import { mergeHandle, type MergeRecord } from './generic-merge.util';

type TransferCollapsedRecord = (
  entity: string,
  loser: MergeRecord,
  winner: MergeRecord,
) => Promise<void>;

/** Moves record attachments by identity without altering their contents or storage files. */
@Injectable()
export class GenericMergeSystemReferencesService {
  constructor(private readonly em: EntityManager) {}

  async transfer(
    entity: string,
    loser: MergeRecord,
    winner: MergeRecord,
    transferCollapsed: TransferCollapsedRecord,
  ): Promise<void> {
    const from = String(loser.handle);
    const to = String(winner.handle);
    await this.transferInformation(entity, from, to, transferCollapsed);
    await this.transferCustomFields(entity, from, to, transferCollapsed);

    for (const metadata of this.em.getMetadata().getAll().values()) {
      if (
        !metadata.class ||
        metadata.abstract ||
        metadata.embeddable ||
        metadata.virtual ||
        metadata.pivotTable
      )
        continue;
      const seen = new Set<string>();
      for (const property of metadata.props) {
        const reference = getSaplingGenericReference(
          metadata.class.prototype as object,
          property.name,
        );
        if (
          !reference ||
          seen.has(reference.handleField) ||
          metadata.class === InformationItem
        )
          continue;
        seen.add(reference.handleField);
        await this.em.nativeUpdate(
          metadata.class,
          {
            [reference.entityField]: entity,
            [reference.handleField]: from,
          },
          { [reference.handleField]: to },
        );
      }
    }

    // Derived search content must never point to a deleted record or describe
    // a discarded field value. The winner's normal update rebuilds its index.
    await this.em.nativeDelete(GlobalSearchIndexItem, {
      entityHandle: entity,
      recordHandle: { $in: [from, to] },
    });
    await this.em.nativeDelete(AiVectorDocumentItem, {
      sourceEntityHandle: entity,
      sourceRecordHandle: { $in: [from, to] },
    });
  }

  private async transferInformation(
    entity: string,
    from: string,
    to: string,
    transferCollapsed: TransferCollapsedRecord,
  ): Promise<void> {
    const rows = await this.em.find(
      InformationItem,
      {
        entity: { handle: entity },
        reference: { $in: [from, to] },
      },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    const source = rows.find((row) => row.reference === from);
    if (!source) return;
    const target = rows.find((row) => row.reference === to);
    if (!target) {
      source.reference = to;
    } else {
      if (source.content?.trim() && source.content !== target.content) {
        target.content = [target.content, source.content]
          .filter((text) => text?.trim())
          .join('\n\n---\n\n');
      }
      await transferCollapsed(
        'information',
        source as unknown as MergeRecord,
        target as unknown as MergeRecord,
      );
      await this.em.nativeDelete(InformationItem, { handle: source.handle });
    }
    await this.em.flush();
  }

  private async transferCustomFields(
    entity: string,
    from: string,
    to: string,
    transferCollapsed: TransferCollapsedRecord,
  ): Promise<void> {
    const rows = await this.em.find(
      CustomFieldValueItem,
      {
        entity: { handle: entity },
        recordReference: { $in: [from, to] },
      },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    const targets = new Map(
      rows
        .filter((row) => row.recordReference === to)
        .map((row) => [mergeHandle(row.definition), row]),
    );
    for (const source of rows.filter((row) => row.recordReference === from)) {
      const target = targets.get(mergeHandle(source.definition));
      if (!target) {
        source.recordReference = to;
      } else {
        await transferCollapsed(
          'customFieldValue',
          source as unknown as MergeRecord,
          target as unknown as MergeRecord,
        );
        await this.em.nativeDelete(CustomFieldValueItem, {
          handle: source.handle,
        });
      }
    }
    await this.em.flush();
  }

  /** Used after hooks too, so a script cannot recreate an orphaned attachment. */
  async assertNoReferences(
    entity: string,
    handle: string | number,
  ): Promise<void> {
    if (
      await this.em.count(CustomFieldValueItem, {
        entity: { handle: entity },
        recordReference: String(handle),
      })
    ) {
      throw new ConflictException('recordMerge.referencesChanged');
    }
    for (const metadata of this.em.getMetadata().getAll().values()) {
      if (!metadata.class || metadata.abstract || metadata.pivotTable) continue;
      for (const property of metadata.props) {
        const reference = getSaplingGenericReference(
          metadata.class.prototype as object,
          property.name,
        );
        if (
          reference &&
          (await this.em.count(metadata.class, {
            [reference.entityField]: entity,
            [reference.handleField]: String(handle),
          }))
        )
          throw new ConflictException('recordMerge.referencesChanged');
      }
    }
  }
}
