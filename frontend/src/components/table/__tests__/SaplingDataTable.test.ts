import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import SaplingDataTable from '../SaplingDataTable.vue'
import { sortDataRows } from '../saplingDataTable.types'

type Row = { name: string; amount: number | null }

function table(items: Row[]) {
  return mount(SaplingDataTable<Row>, {
    props: {
      items,
      columns: [
        { key: 'name', title: 'Name', value: (row) => row.name },
        { key: 'amount', title: 'Betrag', value: (row) => row.amount },
        { key: 'actions', title: 'Aktionen', sortable: false },
      ],
    },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'de',
          messages: { de: { global: { noData: 'Keine Daten' } } },
        }),
      ],
      stubs: {
        VTable: { template: '<div><table><slot /></table></div>' },
        VIcon: true,
      },
    },
  })
}

describe('SaplingDataTable', () => {
  it('cycles numeric sorting and original order without changing the source rows', async () => {
    const items = [
      { name: 'Zehn', amount: 10 },
      { name: 'Zwei', amount: 2 },
      { name: 'Leer', amount: null },
    ]
    const wrapper = table(items)
    const names = () => wrapper.findAll('tbody tr').map((row) => row.find('td').text())
    const sort = wrapper.get('button[aria-label="Betrag"]')
    await sort.trigger('click')
    expect(names()).toEqual(['Zwei', 'Zehn', 'Leer'])
    expect(wrapper.findAll('th')[1].attributes('aria-sort')).toBe('ascending')
    await sort.trigger('click')
    expect(names()).toEqual(['Zehn', 'Zwei', 'Leer'])
    expect(wrapper.findAll('th')[1].attributes('aria-sort')).toBe('descending')
    await sort.trigger('click')
    expect(names()).toEqual(items.map((row) => row.name))
    expect(items.map((row) => row.amount)).toEqual([10, 2, null])
    expect(wrapper.findAll('th')[2].find('button').exists()).toBe(false)
  })

  it('keeps a chosen sort across a refresh and shows an explicit empty state', async () => {
    const wrapper = table([{ name: 'B', amount: 4 }])
    await wrapper.get('button[aria-label="Name"]').trigger('click')
    await wrapper.setProps({
      items: [
        { name: 'Z', amount: 0 },
        { name: 'A', amount: 1 },
      ],
    })
    expect(wrapper.findAll('tbody tr').map((row) => row.find('td').text())).toEqual(['A', 'Z'])
    await wrapper.setProps({ items: [] })
    expect(wrapper.get('tbody td').text()).toBe('Keine Daten')
    expect(wrapper.get('tbody td').attributes('colspan')).toBe('3')
  })

  it('sorts natural labels, booleans and dates stably', () => {
    const labels = ['Test 10', 'Test 2', 'Äpfel', 'apfel']
    expect(sortDataRows(labels, (value) => value, 'asc', 'de')).toEqual([
      'Äpfel',
      'apfel',
      'Test 2',
      'Test 10',
    ])
    expect(sortDataRows([true, false], (value) => value, 'asc', 'de')).toEqual([false, true])
    const dates = [new Date('2026-10-01'), new Date('2026-02-01')]
    expect(sortDataRows(dates, (value) => value, 'asc', 'de')).toEqual([dates[1], dates[0]])
  })
})
