import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type {
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
} from '@/entity/structure'
import type { VuetifyFormValidationResult } from './saplingDialogEdit.utils'

export type VuetifyFormRef = {
  validate: () => Promise<VuetifyFormValidationResult>
  resetValidation?: () => void
}

export type SaplingDialogValidationFeedback = {
  action: DialogSaveAction
  attempt: number
}

export type SaplingDialogEditEmit = {
  (event: 'update:modelValue', value: boolean): void
  (
    event: 'save',
    value: SaplingGenericItem,
    action: DialogSaveAction,
    context: DialogSaveContext,
  ): void
  (event: 'cancel'): void
  (event: 'update:mode', value: DialogState): void
  (event: 'update:item', value: SaplingGenericItem | null): void
}

export interface UseSaplingDialogEditProps {
  modelValue: boolean
  mode: DialogState
  item: SaplingGenericItem | null
  parent?: SaplingGenericItem | null
  parentEntity?: EntityItem | null
  entity: EntityItem | null
  templates: EntityTemplate[]
  showReference?: boolean
}

export interface SaplingDialogEditProps extends UseSaplingDialogEditProps {
  forceDirty?: boolean
  forceDirtyFields?: string[]
  allowPristineCreate?: boolean
}

export type SaplingDialogEditComponentEmit = {
  (event: 'update:modelValue', value: boolean): void
  // Entity-specific dialog payloads may extend SaplingGenericItem with required fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (event: 'save', value: any, action: DialogSaveAction, context: DialogSaveContext): void
  (event: 'cancel'): void
  (event: 'update:mode', value: DialogState): void
  (event: 'update:item', value: SaplingGenericItem | null): void
  (event: 'deleted', value: SaplingGenericItem | null): void
}
