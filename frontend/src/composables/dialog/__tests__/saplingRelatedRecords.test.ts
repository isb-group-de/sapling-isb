import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import { expandRelatedRecordTabs, getRelationRecordFilter } from '../saplingRelatedRecords'
import { applyReferenceTemplateMappings } from '../saplingDialogEdit.utils'

const template = {
  name: 'events',
  mappedBy: 'salesOpportunity',
  relatedRecords: { paths: ['ticket.salesOpportunity', 'internalCase.ticket.salesOpportunity'] },
} as EntityTemplate
describe('indirect relation navigation', () => {
  it('keeps direct relations editable and adds a separate read-only tab only after saving', () => {
    expect(expandRelatedRecordTabs([template], false)).toEqual([template])
    const tabs = expandRelatedRecordTabs([template], true)
    expect(tabs[0]).toBe(template)
    expect(tabs[1]).toMatchObject({ name: 'eventsRelated', options: ['isReadOnly'] })
  })
  it('uses one OR query for rows and counts, including overlapping paths', () => {
    const tabs = expandRelatedRecordTabs([template], true)
    expect(getRelationRecordFilter(tabs[0]!, 12)).toEqual({ salesOpportunity: 12 })
    expect(getRelationRecordFilter(tabs[1]!, 12)).toEqual({
      $or: [
        { ticket: { salesOpportunity: 12 } },
        { internalCase: { ticket: { salesOpportunity: 12 } } },
      ],
    })
  })
  it('fills only empty writable context fields and leaves conflicts for validation', () => {
    const field = {
      referenceTemplate: {
        mappings: ['creatorCompany', 'salesOpportunity'].map((name) => ({
          sourceField: name,
          targetField: name,
          overwrite: false,
        })),
      },
    } as EntityTemplate
    const form = { creatorCompany: 10, salesOpportunity: null }
    applyReferenceTemplateMappings(
      field,
      { creatorCompany: 20, salesOpportunity: 3 },
      form,
      (key) => key !== 'salesOpportunity',
    )
    expect(form).toEqual({ creatorCompany: 10, salesOpportunity: null })
    applyReferenceTemplateMappings(field, { creatorCompany: 20, salesOpportunity: 3 }, form)
    expect(form).toEqual({ creatorCompany: 10, salesOpportunity: 3 })
  })
})
