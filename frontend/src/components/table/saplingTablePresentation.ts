import { computed, inject, type InjectionKey } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import {
  getRowDeadlineState,
  type TablePreferences,
} from '@/composables/table/saplingTablePreferences'

export const tablePresentationKey: InjectionKey<{
  preferences: Readonly<{ value: TablePreferences }>
  groupHeadings: (index: number) => { key: string; level: number; label: string }[]
  canGroup: (field: string) => boolean
}> = Symbol('table-presentation')

export function useTableRowPresentation(props: {
  item: SaplingGenericItem
  entityTemplates: EntityTemplate[]
}) {
  const context = inject(tablePresentationKey, null)
  const fields = computed(() => context?.preferences.value.rowDeadlineFields ?? [])
  return {
    deadlineClass: computed(
      () =>
        `sapling-table-deadline--${getRowDeadlineState(props.item, props.entityTemplates, fields.value)}`,
    ),
    isFieldDeadline: (field: string) => !fields.value.includes(field),
  }
}
