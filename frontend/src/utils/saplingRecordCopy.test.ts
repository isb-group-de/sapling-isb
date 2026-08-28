import { describe, expect, it } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { createSaplingRecordCopy } from './saplingRecordCopy'

describe('createSaplingRecordCopy', () => {
  it('keeps business fields and removes identity, internal, and inverse relation fields', () => {
    const item = {
      handle: 42,
      title: 'Planning',
      externalId: 'EXT-42',
      secret: 'not-copyable',
      createdAt: '2026-08-28T08:00:00.000Z',
      azure: { handle: 17, referenceHandle: 'outlook-event-id' },
    } as SaplingGenericItem
    const templates = [
      { name: 'handle' },
      { name: 'title' },
      { name: 'externalId', isUnique: true },
      { name: 'secret', options: ['isSecurity'] },
      { name: 'createdAt', options: ['isReadOnly', 'isSystem'] },
      {
        name: 'azure',
        isReference: true,
        kind: '1:1',
        mappedBy: 'event',
        options: ['isHideAsReference'],
      },
    ] as EntityTemplate[]

    expect(createSaplingRecordCopy(item, templates)).toEqual({
      title: 'Planning',
    })
    expect(item).toHaveProperty('azure')
  })
})
