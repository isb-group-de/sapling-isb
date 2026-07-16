import { describe, expect, it } from 'vitest'
import {
  dvelopHealthStatusColor,
  dvelopHealthStatusIcon,
  formatDvelopDateTime,
  formatDvelopReference,
} from './dvelopCloudWorkspace.utils'

describe('dvelopCloudWorkspace utilities', () => {
  it('maps health states to stable presentation tokens', () => {
    expect(dvelopHealthStatusColor('success')).toBe('success')
    expect(dvelopHealthStatusColor(undefined)).toBe('default')
    expect(dvelopHealthStatusIcon('warning')).toBe('mdi-alert-circle-outline')
    expect(dvelopHealthStatusIcon(undefined)).toBe('mdi-circle-outline')
  })

  it('formats d.velop references without assuming one display field', () => {
    expect(formatDvelopReference({ handle: 1, title: 'Invoices', dvelopId: 'inv' }, '-')).toBe(
      'Invoices (inv)',
    )
    expect(formatDvelopReference({ handle: 1, dvelopId: 'inv' }, '-')).toBe('inv')
    expect(formatDvelopReference(null, '-')).toBe('-')
  })

  it('uses the fallback for invalid timestamps', () => {
    expect(formatDvelopDateTime('not-a-date', '-')).toBe('-')
    expect(formatDvelopDateTime(null, '-')).toBe('-')
  })
})
