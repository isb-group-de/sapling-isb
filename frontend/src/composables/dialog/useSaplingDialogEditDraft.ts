import { ref, watch, type ComputedRef, type Ref } from 'vue'
import type { DialogState, EntityTemplate } from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import {
  clearSaplingDialogDraft,
  getCurrentDialogDraftRoute,
  normalizeDialogDraftIdentifier,
  readSaplingDialogDraft,
  writeSaplingDialogDraft,
  type SaplingDialogDraftContext,
} from './saplingDialogDraftStorage'

interface UseSaplingDialogEditDraftOptions {
  form: Ref<SaplingGenericItem>
  templates: ComputedRef<EntityTemplate[]>
  mode: ComputedRef<DialogState>
  entity: ComputedRef<EntityItem | null>
  item: ComputedRef<SaplingGenericItem | null>
  parent: ComputedRef<SaplingGenericItem | null | undefined>
  parentEntity: ComputedRef<EntityItem | null | undefined>
  person: ComputedRef<SaplingGenericItem | null | undefined>
  modelValue: ComputedRef<boolean>
  isDirty: ComputedRef<boolean>
  isHydratingForm: Ref<boolean>
}

export function useSaplingDialogEditDraft(options: UseSaplingDialogEditDraftOptions) {
  const activeContext = ref<SaplingDialogDraftContext | null>(null)

  function createContext(): SaplingDialogDraftContext {
    return {
      route: getCurrentDialogDraftRoute(),
      personHandle: normalizeDialogDraftIdentifier(options.person.value?.handle),
      entityHandle: options.entity.value?.handle ?? '',
      mode: options.mode.value,
      recordHandle: normalizeDialogDraftIdentifier(options.item.value?.handle),
      recordVersion: normalizeDialogDraftIdentifier(options.item.value?.updatedAt),
      parentEntityHandle: options.parentEntity.value?.handle ?? '',
      parentRecordHandle: normalizeDialogDraftIdentifier(options.parent.value?.handle),
      detailHandle: '',
      detailVersion: '',
    }
  }

  function restoreDraft(): void {
    const context = createContext()
    activeContext.value = context

    if (!options.modelValue.value || options.mode.value === 'readonly' || !context.entityHandle) {
      return
    }

    const values = readSaplingDialogDraft('edit', context)
    if (!values) {
      return
    }

    options.templates.value.forEach((template) => {
      if (template.type === 'datetime') {
        restoreValue(`${template.name}_date`, values)
        restoreValue(`${template.name}_time`, values)
        return
      }

      restoreValue(template.name, values)
    })
  }

  function restoreValue(key: string, values: Record<string, unknown>): void {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      options.form.value[key] = values[key]
    }
  }

  function collectDraftValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    options.templates.value.forEach((template) => {
      if (template.type === 'datetime') {
        values[`${template.name}_date`] = options.form.value[`${template.name}_date`]
        values[`${template.name}_time`] = options.form.value[`${template.name}_time`]
        return
      }

      values[template.name] = options.form.value[template.name]
    })
    return values
  }

  function clearDraft(): void {
    clearSaplingDialogDraft('edit', activeContext.value ?? createContext())
  }

  watch(
    options.form,
    () => {
      const context = activeContext.value
      if (
        !context ||
        options.isHydratingForm.value ||
        !options.modelValue.value ||
        options.mode.value === 'readonly'
      ) {
        return
      }

      if (!options.isDirty.value) {
        clearSaplingDialogDraft('edit', context)
        return
      }

      writeSaplingDialogDraft('edit', context, collectDraftValues())
    },
    { deep: true, flush: 'post' },
  )

  return { restoreDraft, clearDraft }
}
