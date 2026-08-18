import { describe, expect, it } from 'vitest'
import { sortSelectOptions } from '../saplingSelectOptions'

describe('sortSelectOptions', () => {
  it('sorts labels case-insensitively with natural numeric ordering without mutating the source', () => {
    const source = [{ title: 'KPI 10' }, { title: 'alpha' }, { title: 'KPI 2' }]

    expect(sortSelectOptions(source, (item) => item.title).map((item) => item.title)).toEqual([
      'alpha',
      'KPI 2',
      'KPI 10',
    ])
    expect(source.map((item) => item.title)).toEqual(['KPI 10', 'alpha', 'KPI 2'])
  })
})
