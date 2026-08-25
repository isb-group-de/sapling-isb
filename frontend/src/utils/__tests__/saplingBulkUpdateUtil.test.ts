import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  buildBulkUpdatePayload,
  buildBulkUpdateReferenceParentFilter,
  canClearBulkUpdateTemplate,
  hasBulkUpdateValue,
  isBulkUpdateDependencyBlocked,
  isBulkUpdateTemplateEligible,
  type SaplingBulkUpdateDraftChange,
} from '@/utils/saplingBulkUpdateUtil'

function field(name: string, overrides: Partial<EntityTemplate> = {}): EntityTemplate {
  return {
    key: name,
    name,
    type: 'string',
    isPersistent: true,
    nullable: true,
    fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
    ...overrides,
  }
}

describe('saplingBulkUpdateUtil', () => {
  it('keeps writable value fields and excludes structural or protected fields', () => {
    expect(isBulkUpdateTemplateEligible(field('email', { options: ['isMail'] }))).toBe(true)
    expect(isBulkUpdateTemplateEligible(field('handle'))).toBe(false)
    expect(isBulkUpdateTemplateEligible(field('customerNumber', { isUnique: true }))).toBe(false)
    expect(isBulkUpdateTemplateEligible(field('secret', { options: ['isSecurity'] }))).toBe(false)
    expect(isBulkUpdateTemplateEligible(field('children', { kind: '1:m' }))).toBe(false)
    expect(
      isBulkUpdateTemplateEligible(
        field('readonly', {
          fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: false },
        }),
      ),
    ).toBe(false)
  })

  it('requires read permission for many-to-one reference editors', () => {
    const reference = field('accountManager', {
      isReference: true,
      kind: 'm:1',
      referenceName: 'person',
    })

    expect(isBulkUpdateTemplateEligible(reference, [])).toBe(false)
    expect(
      isBulkUpdateTemplateEligible(reference, [{ entityHandle: 'person', allowRead: true }]),
    ).toBe(true)
  })

  it('allows clearing only nullable, non-required fields', () => {
    expect(canClearBulkUpdateTemplate(field('city'))).toBe(true)
    expect(canClearBulkUpdateTemplate(field('name', { nullable: false }))).toBe(false)
    expect(canClearBulkUpdateTemplate(field('code', { isRequired: true }))).toBe(false)
  })

  it('preserves false, zero, and empty arrays as explicit values', () => {
    expect(hasBulkUpdateValue(false)).toBe(true)
    expect(hasBulkUpdateValue(0)).toBe(true)
    expect(hasBulkUpdateValue([])).toBe(true)
    expect(hasBulkUpdateValue('  ')).toBe(false)
    expect(hasBulkUpdateValue(null)).toBe(false)
  })

  it('builds dependent reference filters from the selected parent change', () => {
    const child = field('contact', {
      isReference: true,
      kind: 'm:1',
      referenceName: 'person',
      referenceDependency: {
        parentField: 'company',
        targetField: 'company',
        requireParent: true,
      },
    })
    const changes: SaplingBulkUpdateDraftChange[] = [
      { fieldName: 'company', operation: 'set', value: 42, displayValue: 'Acme' },
    ]

    expect(isBulkUpdateDependencyBlocked(child, changes)).toBe(false)
    expect(buildBulkUpdateReferenceParentFilter(child, changes)).toEqual({
      company: { $eq: 42 },
    })
    expect(buildBulkUpdateReferenceParentFilter(child, [])).toEqual({
      company: { $in: [] },
    })
  })

  it('serializes set and clear operations without losing false values', () => {
    expect(
      buildBulkUpdatePayload([
        { fieldName: 'isActive', operation: 'set', value: false, displayValue: 'No' },
        { fieldName: 'phone', operation: 'clear', value: '+49', displayValue: '+49' },
      ]),
    ).toEqual({ isActive: false, phone: null })
  })
})
