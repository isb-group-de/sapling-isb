import { ConflictException } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/core';
import { CustomFieldValueItem } from '../../../entity/CustomFieldValueItem';
import { InformationItem } from '../../../entity/InformationItem';
import { DocumentItem } from '../../../entity/DocumentItem';
import { GlobalSearchIndexItem } from '../../../entity/GlobalSearchIndexItem';
import { AiVectorDocumentItem } from '../../../entity/AiVectorDocumentItem';
import { GenericMergeSystemReferencesService } from './generic-merge-system-references.service';

function setup() {
  const notes: Partial<InformationItem>[] = [];
  const values: Partial<CustomFieldValueItem>[] = [];
  const em = {
    getMetadata: () => ({
      getAll: () =>
        new Map([
          [
            'document',
            {
              class: DocumentItem,
              props: [{ name: 'reference' }, { name: 'path' }],
            },
          ],
        ]),
    }),
    find: jest.fn((type: unknown) =>
      Promise.resolve(type === InformationItem ? notes : values),
    ),
    nativeUpdate: jest.fn(() => Promise.resolve(1)),
    nativeDelete: jest.fn(() => Promise.resolve(1)),
    count: jest.fn(() => Promise.resolve(0)),
    flush: jest.fn(() => Promise.resolve()),
  };
  const transferCollapsed = jest.fn(() => Promise.resolve());
  const service = new GenericMergeSystemReferencesService(
    em as unknown as EntityManager,
  );
  const transfer = () =>
    service.transfer(
      'company',
      { handle: 10 },
      { handle: 20 },
      transferCollapsed,
    );
  return { service, em, notes, values, transfer, transferCollapsed };
}

describe('generic merge auxiliary references', () => {
  it('moves decorated references by entity and handle, preserving document file identity', async () => {
    const { transfer, em } = setup();
    await transfer();
    expect(em.nativeUpdate).toHaveBeenCalledTimes(1);
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      DocumentItem,
      { entity: 'company', reference: '10' },
      { reference: '20' },
    );
    expect(em.nativeDelete).toHaveBeenCalledWith(GlobalSearchIndexItem, {
      entityHandle: 'company',
      recordHandle: { $in: ['10', '20'] },
    });
    expect(em.nativeDelete).toHaveBeenCalledWith(AiVectorDocumentItem, {
      sourceEntityHandle: 'company',
      sourceRecordHandle: { $in: ['10', '20'] },
    });
  });

  it('retains the only note without replacing its handle or content', async () => {
    const { transfer, notes, transferCollapsed } = setup();
    notes.push({ handle: 1, reference: '10', content: 'Source note' });
    await transfer();
    expect(notes).toEqual([
      { handle: 1, reference: '20', content: 'Source note' },
    ]);
    expect(transferCollapsed).not.toHaveBeenCalled();
  });

  it('combines both notes and transfers attachments before deleting the redundant note row', async () => {
    const { transfer, notes, transferCollapsed, em } = setup();
    const source = { handle: 1, reference: '10', content: 'Source note' };
    const target = { handle: 2, reference: '20', content: 'Winner note' };
    notes.push(source, target);
    await transfer();
    expect(target.content).toBe('Winner note\n\n---\n\nSource note');
    expect(transferCollapsed).toHaveBeenCalledWith(
      'information',
      source,
      target,
    );
    expect(em.nativeDelete).toHaveBeenCalledWith(InformationItem, {
      handle: 1,
    });
    expect(transferCollapsed.mock.invocationCallOrder[0]).toBeLessThan(
      em.nativeDelete.mock.invocationCallOrder[0],
    );
  });

  it('does not duplicate identical notes', async () => {
    const { transfer, notes } = setup();
    notes.push(
      { handle: 1, reference: '10', content: 'Same' },
      { handle: 2, reference: '20', content: 'Same' },
    );
    await transfer();
    expect(notes[1].content).toBe('Same');
  });

  it('preserves custom definitions only on the loser and consolidates colliding value rows', async () => {
    const { transfer, values, transferCollapsed, em } = setup();
    const definition = { handle: 5 } as CustomFieldValueItem['definition'];
    const source = {
      handle: 1,
      definition,
      recordReference: '10',
      valueString: 'Source',
    };
    const target = {
      handle: 2,
      definition,
      recordReference: '20',
      valueString: 'Winner',
    };
    const additional = {
      handle: 3,
      definition: { handle: 6 } as CustomFieldValueItem['definition'],
      recordReference: '10',
      valueString: 'Additional',
    };
    values.push(source, target, additional);
    await transfer();
    expect(target.valueString).toBe('Winner');
    expect(additional.recordReference).toBe('20');
    expect(additional.valueString).toBe('Additional');
    expect(transferCollapsed).toHaveBeenCalledWith(
      'customFieldValue',
      source,
      target,
    );
    expect(em.nativeDelete).toHaveBeenCalledWith(CustomFieldValueItem, {
      handle: 1,
    });
  });

  it('stops deletion if a script recreates a custom field reference to the loser', async () => {
    const { service, em } = setup();
    em.count.mockResolvedValueOnce(1);
    await expect(
      service.assertNoReferences('company', 10),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(em.count).toHaveBeenCalledWith(CustomFieldValueItem, {
      entity: { handle: 'company' },
      recordReference: '10',
    });
  });

  it('stops deletion if a script recreates a decorated reference to the loser', async () => {
    const { service, em } = setup();
    em.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(
      service.assertNoReferences('company', 10),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
