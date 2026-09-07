import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useSaplingWidgetDialog } from '../useSaplingWidgetDialog'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({ accumulatedPermission: [], fetchCurrentPermission: vi.fn() }),
}))
vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({ loadGeneric: vi.fn(), getState: () => ({ entityTemplates: [] }) }),
}))

describe('widget worklist import', () => {
  it.each([
    {
      id: 'note',
      kind: 'NOTE',
      title: 'Note',
      columns: 1,
      rows: 2,
      config: { markdown: '# Heading\n**Important**\n- [ ] Task' },
    },
    {
      id: 'actions',
      kind: 'ACTIONS',
      title: 'Create',
      columns: 1,
      rows: 1,
      config: {
        actions: [
          { id: 'a', entity: 'ticket', label: 'New ticket' },
          { id: 'b', entity: 'event', label: 'New event' },
        ],
      },
    },
  ] as DashboardWidget[])(
    'round-trips $kind settings without mutating the saved widget',
    async (widget) => {
      let dialog!: ReturnType<typeof useSaplingWidgetDialog>
      const wrapper = mount(
        defineComponent({
          setup() {
            dialog = useSaplingWidgetDialog(widget)
            return () => null
          },
        }),
      )
      await flushPromises()
      expect(dialog.build()).toEqual(widget)
      dialog.actions.value[0]!.label = 'Changed draft'
      dialog.markdown.value = 'Changed draft'
      expect(widget.config).not.toHaveProperty('markdown', 'Changed draft')
      expect(JSON.stringify(widget)).not.toContain('Changed draft')
      wrapper.unmount()
    },
  )
  it.each(['TABLE', 'AGENDA'] as const)(
    'copies complete worklist filters into %s widgets',
    async (kind) => {
      const filter = {
        $and: [{ status: { isOpen: true } }, { assigneePerson: '{{currentUser.handle}}' }],
      }
      const existing: DashboardWidget =
        kind === 'TABLE'
          ? {
              id: 'table',
              kind,
              title: 'Tickets',
              columns: 2,
              rows: 4,
              config: {
                entity: 'ticket',
                filter: {},
                columns: [],
                sortBy: [],
                search: '',
                pageSize: 10,
              },
            }
          : {
              id: 'agenda',
              kind,
              title: 'Agenda',
              columns: 1,
              rows: 2,
              config: { filter: {}, days: 30, limit: 5 },
            }
      let dialog!: ReturnType<typeof useSaplingWidgetDialog>
      const wrapper = mount(
        defineComponent({
          setup() {
            dialog = useSaplingWidgetDialog(existing)
            return () => null
          },
        }),
      )
      await flushPromises()
      dialog.favorite.value = {
        handle: 1,
        title: 'My open records',
        filter,
        search: 'server',
        sortBy: [{ key: 'title', order: 'desc' }],
      }
      await nextTick()
      const built = dialog.build()
      expect(built.config).toMatchObject({ filter })
      expect(built.config).not.toHaveProperty('person')
      expect((built.config as { filter: unknown }).filter).not.toBe(filter)
      dialog.resetFilters()
      expect(dialog.build().config).toMatchObject({ filter: {} })
      expect(filter.$and).toHaveLength(2)
      wrapper.unmount()
    },
  )
})
