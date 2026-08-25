import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  getEditDialogHeaders,
  getListProjectionFieldNames,
  getTableHeaders,
  isFilterableTableColumn,
} from './saplingTableTemplateUtil'

const template = (
  name: string,
  access: { allowRead: boolean; allowInsert: boolean; allowUpdate: boolean },
  extra: Partial<EntityTemplate> = {},
): EntityTemplate =>
  ({
    name,
    type: 'string',
    options: [],
    isPersistent: true,
    formVisible: true,
    tableVisible: true,
    fieldAccess: access,
    ...extra,
  }) as EntityTemplate

describe('sapling table template field access', () => {
  const readWrite = { allowRead: true, allowInsert: true, allowUpdate: true }

  it('does not request or display a read-denied primary key', () => {
    const hiddenHandle = template(
      'handle',
      { allowRead: false, allowInsert: false, allowUpdate: false },
      {},
    )

    expect(getListProjectionFieldNames([hiddenHandle])).toEqual([])
    expect(getTableHeaders([hiddenHandle], null, (key) => key)).toEqual([])
    expect(isFilterableTableColumn(hiddenHandle)).toBe(false)
  })

  it('separates create, edit, and readonly visibility including write-only fields', () => {
    const readable = template('title', readWrite)
    const writeOnly = template('password', {
      allowRead: false,
      allowInsert: true,
      allowUpdate: true,
    })
    const readOnly = template('number', {
      allowRead: true,
      allowInsert: false,
      allowUpdate: false,
    })
    const fields = [readable, writeOnly, readOnly]

    expect(getEditDialogHeaders(fields, 'create', true).map((item) => item.name)).toEqual([
      'title',
      'password',
    ])
    expect(getEditDialogHeaders(fields, 'edit', true).map((item) => item.name)).toEqual([
      'title',
      'password',
      'number',
    ])
    expect(getEditDialogHeaders(fields, 'readonly', true).map((item) => item.name)).toEqual([
      'title',
      'number',
    ])
  })
})
