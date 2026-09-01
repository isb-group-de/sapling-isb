import { describe, expect, it } from 'vitest'
import type { SaplingTableHeaderItem } from '@/entity/structure'
import {
  applyTableColumnOrder,
  buildPersonalTableViewConfig,
  placeTableColumnKey,
  removeTableColumnKey,
  reorderTableColumnKeys,
  selectTableColumns,
} from '@/composables/table/saplingTableColumnOrder'

describe('saplingTableColumnOrder', () => {
  it('moves columns before and after another column without losing keys', () => {
    expect(
      reorderTableColumnKeys(['firstName', 'lastName', 'email'], {
        sourceKey: 'email',
        targetKey: 'firstName',
        placement: 'before',
      }),
    ).toEqual(['email', 'firstName', 'lastName'])

    expect(
      reorderTableColumnKeys(['firstName', 'lastName', 'email'], {
        sourceKey: 'firstName',
        targetKey: 'email',
        placement: 'after',
      }),
    ).toEqual(['lastName', 'email', 'firstName'])
  })

  it('places an available column at the requested table position', () => {
    expect(
      placeTableColumnKey(['firstName', 'lastName'], {
        sourceKey: 'email',
        targetKey: 'lastName',
        placement: 'before',
      }),
    ).toEqual(['firstName', 'email', 'lastName'])
  })

  it('removes visible columns but keeps at least one table column', () => {
    expect(removeTableColumnKey(['firstName', 'lastName'], 'firstName')).toEqual(['lastName'])
    expect(removeTableColumnKey(['lastName'], 'lastName')).toEqual(['lastName'])
  })

  it('selects only the requested columns in the requested order', () => {
    const headers = ['firstName', 'lastName', 'email'].map(
      (key) => ({ key, name: key, title: key, type: 'string' }) as SaplingTableHeaderItem,
    )

    expect(selectTableColumns(headers, ['email', 'firstName']).map((header) => header.key)).toEqual(
      ['email', 'firstName'],
    )
  })

  it('applies a temporary order and appends newly available headers', () => {
    const headers = ['firstName', 'lastName', 'email'].map(
      (key) => ({ key, name: key, title: key, type: 'string' }) as SaplingTableHeaderItem,
    )

    expect(
      applyTableColumnOrder(headers, ['email', 'firstName']).map((header) => header.key),
    ).toEqual(['email', 'firstName', 'lastName'])
  })

  it('clones the active configuration and stores the visible desktop order', () => {
    const config = buildPersonalTableViewConfig(
      'person',
      {
        schema: 'sapling.form-config.v1',
        entityHandle: 'person',
        fields: {
          email: { tableVisible: true, tableOrder: 5, label: 'E-mail' },
          phone: { tableVisible: false },
        },
        groups: { contact: { label: 'Contact' } },
      },
      ['lastName', 'email'],
      ['lastName', 'email', 'phone'],
    )

    expect(config.fields).toEqual({
      email: { tableVisible: true, tableOrder: 1, label: 'E-mail' },
      phone: { tableVisible: false, tableOrder: null },
      lastName: { tableVisible: true, tableOrder: 0 },
    })
    expect(config.groups).toEqual({ contact: { label: 'Contact' } })
    expect(config.metadata).toEqual({ tableOrderMode: 'absolute' })
  })
})
