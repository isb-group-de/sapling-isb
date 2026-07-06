import type { ComputedRef, InjectionKey } from 'vue'

export interface SaplingTableDisplayContext {
  isMobileTable: ComputedRef<boolean>
}

export const saplingTableDisplayContextKey: InjectionKey<SaplingTableDisplayContext> = Symbol(
  'sapling-table-display-context',
)
