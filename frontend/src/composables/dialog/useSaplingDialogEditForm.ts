import { nextTick, type ComputedRef, type Ref } from 'vue'
import type { DialogState, EntityTemplate } from '@/entity/structure'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'

interface UseSaplingDialogEditFormOptions {
  form: Ref<SaplingGenericItem>
  templates: ComputedRef<EntityTemplate[]>
  mode: ComputedRef<DialogState>
  item: ComputedRef<SaplingGenericItem | null>
  parent: ComputedRef<SaplingGenericItem | null | undefined>
  parentEntity: ComputedRef<EntityItem | null | undefined>
  relationTemplates: ComputedRef<EntityTemplate[]>
  currentPerson: ComputedRef<SaplingGenericItem | null | undefined>
  isHydratingForm: Ref<boolean>
  isLoading: Ref<boolean>
  initialFormSnapshot: Ref<Record<string, string>>
  hasFormValue: (value: unknown) => boolean
  syncInitialFormSnapshot: () => void
  formatLocalDate: (date: Date) => string
  formatLocalTime: (date: Date) => string
  getLocalDateTimeParts: (value: unknown) => { date: string; time: string }
  toUtcIsoString: (dateValue: unknown, timeValue: unknown) => string | null
}

export function useSaplingDialogEditForm(options: UseSaplingDialogEditFormOptions) {
  function getCurrentCompanyReference(): SaplingGenericItem | null {
    const company = options.currentPerson.value?.company

    if (!company) {
      return null
    }

    if (typeof company === 'object') {
      return company
    }

    return { handle: company }
  }

  function applyCurrentDefaults(): void {
    if (options.mode.value !== 'create' || !options.currentPerson.value) {
      return
    }

    const currentCompany = getCurrentCompanyReference()
    let didApplyDefaults = false

    options.templates.value
      .filter((template) => template.isReference && template.options?.includes('isCurrentPerson'))
      .forEach((template) => {
        if (options.form.value[template.name] == null || options.form.value[template.name] === '') {
          options.form.value[template.name] = options.currentPerson.value
          didApplyDefaults = true
        }
      })

    options.templates.value
      .filter((template) => template.isReference && template.options?.includes('isCurrentCompany'))
      .forEach((template) => {
        if (options.form.value[template.name] == null || options.form.value[template.name] === '') {
          options.form.value[template.name] = currentCompany
          didApplyDefaults = true
        }
      })

    if (didApplyDefaults && (options.isHydratingForm.value || options.isLoading.value)) {
      void nextTick(() => options.syncInitialFormSnapshot())
    }
  }

  function initializeForm(): void {
    const now = new Date()
    const currentCompany = getCurrentCompanyReference()

    options.isHydratingForm.value = true
    options.initialFormSnapshot.value = {}
    options.form.value = {}

    options.templates.value.forEach((template) => {
      if (isWriteOnlyEditField(template)) {
        if (template.type === 'datetime') {
          options.form.value[`${template.name}_date`] = ''
          options.form.value[`${template.name}_time`] = ''
        } else if (template.inlineCollection || ['m:n', 'n:m'].includes(template.kind ?? '')) {
          options.form.value[template.name] = []
        } else if (template.isReference) {
          options.form.value[template.name] = null
        } else {
          options.form.value[template.name] = ''
        }
        return
      }

      if (template.inlineCollection) {
        const value = options.item.value?.[template.name]
        options.form.value[template.name] = Array.isArray(value) ? value : []
        return
      }

      if (template.isReference) {
        initializeReferenceTemplate(template, currentCompany)
        return
      }

      if (template.type === 'datetime') {
        initializeDateTimeTemplate(template, now)
        return
      }

      initializeScalarTemplate(template, now)
    })

    void nextTick(() => {
      options.isHydratingForm.value = false
      options.syncInitialFormSnapshot()
    })
  }

  function initializeDateTimeTemplate(template: EntityTemplate, now: Date): void {
    const dateField = options.item.value?.[`${template.name}_date`]
    const timeField = options.item.value?.[`${template.name}_time`]

    if (dateField !== undefined || timeField !== undefined) {
      options.form.value[`${template.name}_date`] = typeof dateField === 'string' ? dateField : ''
      options.form.value[`${template.name}_time`] = typeof timeField === 'string' ? timeField : ''
      return
    }

    const initialValue = options.item.value?.[template.name] ?? getTemplateDefaultValue(template)
    const { date, time } = options.getLocalDateTimeParts(initialValue)

    if (date || time) {
      options.form.value[`${template.name}_date`] = date
      options.form.value[`${template.name}_time`] = time
      return
    }

    if (options.mode.value === 'create' && template.options?.includes('isToday')) {
      options.form.value[`${template.name}_date`] = options.formatLocalDate(now)
      options.form.value[`${template.name}_time`] = options.formatLocalTime(now)
      return
    }

    options.form.value[`${template.name}_date`] = ''
    options.form.value[`${template.name}_time`] = ''
  }

  function initializeScalarTemplate(template: EntityTemplate, now: Date): void {
    const defaultValue = getTemplateDefaultValue(template)

    if (options.item.value) {
      options.form.value[template.name] = options.item.value[template.name] ?? defaultValue ?? ''
      return
    }

    if (defaultValue !== undefined && defaultValue !== null) {
      options.form.value[template.name] = defaultValue
      return
    }

    if (template.type === 'DateType' && template.options?.includes('isToday')) {
      options.form.value[template.name] = options.formatLocalDate(now)
      return
    }

    if (template.type === 'time' && template.options?.includes('isToday')) {
      options.form.value[template.name] = options.formatLocalTime(now)
      return
    }

    options.form.value[template.name] = template.type === 'boolean' ? false : ''
  }

  function initializeReferenceTemplate(
    template: EntityTemplate,
    currentCompany: SaplingGenericItem | null,
  ): void {
    const itemValue = options.item.value?.[template.name]
    const normalizedItemValue = normalizeReferenceFormValue(itemValue, template)

    if (normalizedItemValue != null) {
      options.form.value[template.name] = normalizedItemValue
      return
    }

    if (options.mode.value === 'create') {
      const normalizedDefaultValue = normalizeReferenceFormValue(
        getTemplateDefaultValue(template),
        template,
      )

      if (normalizedDefaultValue != null) {
        options.form.value[template.name] = normalizedDefaultValue
        return
      }

      if (template.options?.includes('isCurrentPerson') && options.currentPerson.value) {
        options.form.value[template.name] = options.currentPerson.value
        return
      }

      if (template.options?.includes('isCurrentCompany') && currentCompany) {
        options.form.value[template.name] = currentCompany
        return
      }
    }

    options.form.value[template.name] = null
  }

  function getTemplateDefaultValue(template: EntityTemplate): unknown {
    if (
      template.formConfig &&
      Object.prototype.hasOwnProperty.call(template.formConfig, 'defaultValue')
    ) {
      return template.formConfig.defaultValue
    }

    return template.default
  }

  function normalizeReferenceFormValue(
    value: unknown,
    template: EntityTemplate,
  ): SaplingGenericItem | SaplingGenericItem[] | null {
    if (value === null || value === undefined || value === '') {
      return null
    }

    if (Array.isArray(value)) {
      const normalizedValues = value
        .map((entry) => normalizeSingleReferenceFormValue(entry, template))
        .filter((entry): entry is SaplingGenericItem => entry != null)

      return normalizedValues.length > 0 ? normalizedValues : null
    }

    return normalizeSingleReferenceFormValue(value, template)
  }

  function normalizeSingleReferenceFormValue(
    value: unknown,
    template: EntityTemplate,
  ): SaplingGenericItem | null {
    if (value && typeof value === 'object') {
      return value as SaplingGenericItem
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null
    }

    const primaryKey = template.referencedPks?.length === 1 ? template.referencedPks[0] : 'handle'
    return primaryKey ? { [primaryKey]: value } : null
  }

  function syncParentReferences(): void {
    if (!options.parent.value || options.mode.value !== 'create') {
      return
    }

    let didSyncParentReferences = false

    options.templates.value
      .filter((template) => ['m:1', 'm:n', 'n:m'].includes(template.kind ?? ''))
      .forEach((template) => {
        if (template.referenceName !== options.parentEntity.value?.handle) {
          return
        }

        if (options.hasFormValue(options.form.value[template.name])) {
          return
        }

        options.form.value[template.name] =
          template.kind === 'm:1' ? options.parent.value : [options.parent.value]
        didSyncParentReferences = true
      })

    if (didSyncParentReferences && (options.isHydratingForm.value || options.isLoading.value)) {
      void nextTick(() => options.syncInitialFormSnapshot())
    }
  }

  function buildSavePayload(): SaplingGenericItem {
    const output = { ...options.form.value }
    const writableTemplates = options.templates.value.filter(isWritableForCurrentMode)
    const nonWritableTemplates = options.templates.value.filter(
      (template) => !isWritableForCurrentMode(template),
    )
    const customFields: Record<string, unknown> = {}
    const unchangedWriteOnlyFields = new Set(
      writableTemplates
        .filter((template) => isWriteOnlyEditField(template))
        .filter((template) => {
          if (template.type === 'datetime') {
            return (
              options.form.value[`${template.name}_date`] ===
                options.initialFormSnapshot.value[`${template.name}_date`] &&
              options.form.value[`${template.name}_time`] ===
                options.initialFormSnapshot.value[`${template.name}_time`]
            )
          }
          return valuesEqual(
            options.form.value[template.name],
            options.initialFormSnapshot.value[template.name],
          )
        })
        .map((template) => template.name),
    )

    nonWritableTemplates.forEach((template) => {
      delete output[template.name]
      if (template.type === 'datetime') {
        delete output[`${template.name}_date`]
        delete output[`${template.name}_time`]
      }
    })

    if (options.mode.value === 'edit') {
      options.relationTemplates.value.forEach((template) => delete output[template.name])
    }

    writableTemplates
      .filter((template) => template.type === 'datetime')
      .forEach((template) => {
        const key = template.name
        const dateValue = output[`${key}_date`]
        const date =
          dateValue instanceof Date
            ? options.formatLocalDate(dateValue)
            : typeof dateValue === 'string'
              ? dateValue
              : ''
        const normalizedDateTime = options.toUtcIsoString(date, output[`${key}_time`])

        if (normalizedDateTime) {
          output[key] = normalizedDateTime
        }

        delete output[`${key}_date`]
        delete output[`${key}_time`]
      })

    writableTemplates
      .filter((template) => template.kind === 'm:1')
      .forEach((template) => {
        output[template.name] = normalizeSingleReferenceValue(
          options.form.value[template.name],
          template,
        )
      })

    if (options.mode.value === 'create') {
      writableTemplates
        .filter((template) => ['m:n', 'n:m'].includes(template.kind ?? ''))
        .forEach((template) => {
          output[template.name] = normalizeCollectionReferenceValue(
            options.form.value[template.name],
            template,
          )
        })
    }

    writableTemplates
      .filter((template) => template.customField?.key || template.name.startsWith('customFields.'))
      .forEach((template) => {
        const fieldKey = template.customField?.key ?? template.name.slice('customFields.'.length)
        if (!fieldKey) {
          return
        }

        if (!unchangedWriteOnlyFields.has(template.name)) {
          customFields[fieldKey] = output[template.name]
        }
        delete output[template.name]
      })

    for (const fieldName of unchangedWriteOnlyFields) {
      delete output[fieldName]
    }

    if (Object.keys(customFields).length > 0) {
      output.customFields = customFields
    }

    return output
  }

  function isWritableForCurrentMode(template: EntityTemplate): boolean {
    if (options.mode.value === 'create') {
      return template.fieldAccess?.allowInsert !== false
    }
    if (options.mode.value === 'edit') {
      return template.isPrimaryKey !== true && template.fieldAccess?.allowUpdate !== false
    }
    return false
  }

  function isWriteOnlyEditField(template: EntityTemplate): boolean {
    return (
      options.mode.value === 'edit' &&
      template.fieldAccess?.allowRead === false &&
      template.fieldAccess?.allowUpdate === true
    )
  }

  function valuesEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true
    try {
      return JSON.stringify(left) === JSON.stringify(right)
    } catch {
      return false
    }
  }

  function normalizeSingleReferenceValue(value: unknown, template: EntityTemplate): unknown {
    if (!value || typeof value !== 'object') {
      return value ?? null
    }

    const valueObject = value as Record<string, unknown>
    const pkValues =
      template.referencedPks
        ?.map((primaryKey) => valueObject[primaryKey])
        .filter((entry) => entry !== undefined && entry !== null) ?? []

    if (pkValues.length === 1) {
      return pkValues[0]
    }

    if (pkValues.length > 1) {
      return pkValues
    }

    return null
  }

  function normalizeCollectionReferenceValue(value: unknown, template: EntityTemplate): unknown {
    if (!Array.isArray(value) || !template.referencedPks) {
      return value ?? null
    }

    return value
      .map((entry) => {
        if (typeof entry === 'string' || typeof entry === 'number') {
          return [entry]
        }

        if (!entry || typeof entry !== 'object') {
          return []
        }

        return template
          .referencedPks!.map((primaryKey) => (entry as Record<string, unknown>)[primaryKey])
          .filter((primaryKeyValue) => primaryKeyValue !== undefined && primaryKeyValue !== null)
      })
      .filter((entry) => entry.length > 0)
      .flat()
  }

  return {
    applyCurrentDefaults,
    initializeForm,
    syncParentReferences,
    buildSavePayload,
  }
}
