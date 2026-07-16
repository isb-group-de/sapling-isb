import type { ColumnFilterItem, ColumnFilterOperator } from '@/entity/structure'
import type { TableColumnLike } from './useSaplingTableFilterHelpers'

export type SaplingTableFilterInputKind =
  | 'boolean'
  | 'color'
  | 'icon'
  | 'money'
  | 'percent'
  | 'phone'
  | 'mail'
  | 'link'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'text'

export type SaplingTableFilterVariant = 'boolean' | 'icon' | 'relation' | 'range' | 'single'

export interface SaplingTableColumnFilterProps {
  column: TableColumnLike
  filterItem?: ColumnFilterItem | null
  title: string
  operatorOptions: Array<{ label: string; value: ColumnFilterOperator }>
  sortIcon: unknown
  loading?: boolean
}

export type SaplingTableColumnFilterEmit = {
  (event: 'update:filter', value: ColumnFilterItem | null): void
}
