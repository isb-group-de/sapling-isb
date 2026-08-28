import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import { getDialogRecordCopyRelations, getDialogRecordRelations } from './saplingDialogRecordLoader'

describe('saplingDialogRecordLoader', () => {
  const templates = [
    { name: 'company', isReference: true, kind: 'm:1' },
    { name: 'participants', isReference: false, kind: 'm:n' },
    { name: 'tags', kind: 'n:m' },
    { name: 'deliveries', isReference: true, kind: '1:m' },
  ] as EntityTemplate[]

  it('keeps collection relations lazy for normal editing', () => {
    expect(getDialogRecordRelations(templates)).toEqual(['m:1'])
  })

  it('hydrates reusable many-to-many links for copying', () => {
    expect(getDialogRecordCopyRelations(templates)).toEqual(['m:1', 'participants', 'tags'])
  })
})
