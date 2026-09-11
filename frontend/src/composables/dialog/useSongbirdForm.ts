import { computed, nextTick, onUnmounted, ref, watch, type Ref } from 'vue'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import type { UseSaplingDialogEditProps, VuetifyFormRef } from './saplingDialogEdit.types'
import type {
  SongbirdFormContext,
  SongbirdFormProposal,
} from '@/composables/system/songbirdForm.types'
import { songbirdForms, songbirdFormProposals } from '@/composables/system/songbirdFormRegistry'
import { describeSongbirdFormField, normalizeSongbirdFormValue } from './songbirdFormFields'
import ApiGenericService from '@/services/api.generic.service'
import { useWorkspaceTab } from '@/composables/system/workspaceTabContext'

export function useSongbirdForm(options: {
  props: UseSaplingDialogEditProps
  form: Ref<SaplingGenericItem>
  templates: Ref<EntityTemplate[]>
  permissions: Ref<AccumulatedPermission[] | null>
  isLoading: Ref<boolean>
  isSaving: Ref<boolean>
  formRef: Ref<VuetifyFormRef | null>
  isFieldDisabled: (template: EntityTemplate) => boolean
  updateFormField: (name: string, value: unknown) => void
  focus: () => void
  translate: (key: string) => string
}) {
  const formId = ref('')
  const workspaceTab = useWorkspaceTab()
  const snapshots = new Map<
    string,
    { baseline: Record<string, unknown>; context: SongbirdFormContext }
  >()
  const cloneForm = () => JSON.parse(JSON.stringify(options.form.value)) as Record<string, unknown>
  const valueFingerprint = (value: unknown) => JSON.stringify(value) ?? 'undefined'
  const fieldValueKeys = (field: SongbirdFormContext['fields'][number]) =>
    field.type === 'datetime' ? [`${field.name}_date`, `${field.name}_time`] : [field.name]
  const changedFields = (
    baseline: Record<string, unknown>,
    context: SongbirdFormContext,
    names: string[],
  ) =>
    names.filter((name) => {
      const field = context.fields.find((item) => item.name === name)
      return (
        !field ||
        fieldValueKeys(field).some(
          (key) => valueFingerprint(options.form.value[key]) !== valueFingerprint(baseline[key]),
        )
      )
    })
  const available = () =>
    workspaceTab?.active !== false &&
    options.props.modelValue &&
    !options.isLoading.value &&
    !options.isSaving.value &&
    options.props.mode !== 'readonly' &&
    options.permissions.value?.some(
      (permission) =>
        permission.entityHandle === options.props.entity?.handle &&
        (options.props.mode === 'create' ? permission.allowInsert : permission.allowUpdate) ===
          true,
    ) === true
  const fields = computed(() =>
    options.templates.value
      .filter((template) => !options.isFieldDisabled(template))
      .map((template) =>
        describeSongbirdFormField(
          template,
          template.formConfig?.label ||
            options.translate(options.props.entity?.handle + '.' + template.name),
        ),
      )
      .filter((field) => field !== null),
  )
  function capture(): SongbirdFormContext | null {
    if (!available() || !options.props.entity?.handle || !fields.value.length) return null
    const context: SongbirdFormContext = {
      formId: formId.value,
      snapshotId: crypto.randomUUID(),
      entityHandle: options.props.entity.handle,
      recordHandle: options.props.item?.handle == null ? null : String(options.props.item.handle),
      mode: options.props.mode === 'create' ? 'create' : 'edit',
      fields: JSON.parse(JSON.stringify(fields.value)),
    }
    snapshots.set(context.snapshotId, { context, baseline: cloneForm() })
    return context
  }
  async function apply(
    proposal: SongbirdFormProposal,
    names: string[],
    overwriteChanged: boolean,
  ): Promise<boolean> {
    const snapshot = snapshots.get(proposal.snapshotId)
    if (!snapshot) throw new Error('aiChat.formUnavailable')
    const assertTarget = () => {
      if (
        !available() ||
        proposal.formId !== formId.value ||
        proposal.entityHandle !== snapshot.context.entityHandle ||
        proposal.recordHandle !== snapshot.context.recordHandle
      )
        throw new Error('aiChat.formUnavailable')
    }
    assertTarget()
    if (!overwriteChanged && changedFields(snapshot.baseline, snapshot.context, names).length)
      throw new Error('aiChat.formFieldsChanged')
    const applyBaseline = cloneForm()
    const updates: { name: string; value: unknown }[] = []
    for (const name of names) {
      const field = fields.value.find((item) => item.name === name)
      const proposed = proposal.fields.find((item) => item.name === name)
      if (!field || !proposed || !snapshot?.context.fields.some((item) => item.name === name))
        throw new Error('aiChat.formFieldUnavailable')
      let value = normalizeSongbirdFormValue(field, proposed.value)
      if (field.type === 'reference' && value !== null) {
        const template = options.templates.value.find((item) => item.name === name)!
        const records = await ApiGenericService.findByHandles<SaplingGenericItem>(
          field.referenceEntity!,
          [value as string | number],
          {
            relations: template.referenceDependency?.targetField
              ? [template.referenceDependency.targetField]
              : undefined,
            suppressErrorMessage: true,
          },
        )
        if (!records[0]) throw new Error('aiChat.formReferenceUnavailable')
        value = records[0]
      }
      if (field.type === 'datetime') {
        const [date = '', time = ''] = typeof value === 'string' ? value.split('T') : []
        updates.push(
          { name: name + '_date', value: date },
          { name: name + '_time', value: time.slice(0, 5) },
        )
      } else updates.push({ name, value })
    }
    const candidate = {
      ...options.form.value,
      ...Object.fromEntries(updates.map((update) => [update.name, update.value])),
    }
    const referenceId = (value: unknown): string | null => {
      if (value && typeof value === 'object' && !Array.isArray(value))
        value = (value as SaplingGenericItem).handle
      return typeof value === 'string' || typeof value === 'number' ? String(value) : null
    }
    for (const update of updates) {
      const template = options.templates.value.find((item) => item.name === update.name)
      const dependency = template?.referenceDependency
      if (!dependency || update.value === null || typeof update.value !== 'object') continue
      const parent = referenceId(candidate[dependency.parentField])
      const childParent = referenceId((update.value as SaplingGenericItem)[dependency.targetField])
      if (
        (parent === null && dependency.requireParent) ||
        (parent !== null && childParent !== parent)
      )
        throw new Error('aiChat.formReferenceUnavailable')
    }
    assertTarget()
    if (changedFields(applyBaseline, snapshot.context, names).length)
      throw new Error('aiChat.formFieldsChanged')
    // Check all permissions again after asynchronous reference hydration.
    if (names.some((name) => !fields.value.some((field) => field.name === name)))
      throw new Error('aiChat.formFieldUnavailable')
    for (const update of updates) options.updateFormField(update.name, update.value)
    options.focus()
    await nextTick()
    const result = await options.formRef.value?.validate()
    snapshots.delete(proposal.snapshotId)
    return typeof result === 'boolean' ? result : result?.valid === true
  }
  watch(
    () => [
      options.props.modelValue,
      options.props.entity?.handle,
      options.props.item?.handle,
      options.props.item?.updatedAt,
      options.props.mode,
    ],
    () => {
      if (formId.value) songbirdForms.delete(formId.value)
      snapshots.clear()
      formId.value = options.props.modelValue ? crypto.randomUUID() : ''
      if (formId.value)
        songbirdForms.set(formId.value, {
          formId: formId.value,
          capture,
          apply,
          focus: options.focus,
          isAvailable: available,
        })
    },
    { immediate: true },
  )
  onUnmounted(() => {
    songbirdForms.delete(formId.value)
    snapshots.clear()
  })
  const proposals = computed(() =>
    [...songbirdFormProposals.values()].filter((state) => state.proposal.formId === formId.value),
  )
  return { formId, proposals }
}
