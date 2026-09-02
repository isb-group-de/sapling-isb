import type { ComputedRef, Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { hasFormValue } from './saplingDialogEdit.utils'
import { findSaplingDateRangePair, isSaplingDateRangeValid } from './saplingDateRangeValidation'
import type { SaplingReferenceAvailability } from './useSaplingDialogEditReferences'
import type { DialogState } from '@/entity/structure'

interface SaplingDialogEditFieldRuleOptions {
  mode: () => DialogState
  entityHandle: () => string | undefined
  form: Ref<SaplingGenericItem>
  baseTemplates: ComputedRef<EntityTemplate[]>
  translate: (key: string, params?: Record<string, unknown>) => string
  getReferenceAvailability: (template: EntityTemplate) => SaplingReferenceAvailability
  isReferenceDependencyBlocked: (template: EntityTemplate) => boolean
}

export function useSaplingDialogEditFieldRules(options: SaplingDialogEditFieldRuleOptions) {
  function isTemplateRequired(template: EntityTemplate): boolean {
    if (template.type === 'boolean' || template.formConfig?.renderer === 'boolean') return false
    if (template.formConfig?.required === true) return true
    if (template.formConfig?.required === false && template.nullable !== false) return false
    return template.isRequired === true
  }

  function isTemplateRecommended(template: EntityTemplate): boolean {
    if (
      template.type === 'boolean' ||
      template.formConfig?.renderer === 'boolean' ||
      isTemplateRequired(template)
    ) {
      return false
    }
    return typeof template.formConfig?.recommended === 'boolean'
      ? template.formConfig.recommended
      : template.options?.includes('isRecommended') === true
  }

  function isFieldDisabled(template: EntityTemplate): boolean {
    const mode = options.mode()
    return (
      (template.name === 'handle' && mode !== 'create') ||
      (mode === 'create'
        ? template.fieldAccess?.allowInsert === false
        : mode === 'edit'
          ? template.fieldAccess?.allowUpdate === false
          : template.fieldAccess?.allowRead === false) ||
      template.options?.includes('isReadOnly') ||
      template.formConfig?.readonly === true ||
      mode === 'readonly'
    )
  }

  function isReferenceFieldDisabled(template: EntityTemplate): boolean {
    return isFieldDisabled(template) || options.isReferenceDependencyBlocked(template)
  }

  function isTemplateRecommendationActive(template: EntityTemplate): boolean {
    if (
      options.mode() === 'readonly' ||
      !isTemplateRecommended(template) ||
      isFieldDisabled(template) ||
      hasFormValue(options.form.value[template.name])
    ) {
      return false
    }
    return !template.isReference || options.getReferenceAvailability(template) === 'available'
  }

  function getRecommendationMessage(template: EntityTemplate): string {
    const field = options.translate(`${options.entityHandle()}.${template.name}`)
    return template.isReference
      ? options.translate('global.recommendedReferenceAvailable', { field })
      : options.translate('global.recommendedFieldMissing', { field })
  }

  function getRules(template: EntityTemplate): Array<(value: unknown) => true | string> {
    const rules: Array<(value: unknown) => true | string> = []
    if (isTemplateRequired(template)) {
      const label = options.translate(`${options.entityHandle()}.${template.name}`)
      rules.push((value) =>
        value !== null && value !== undefined && value !== ''
          ? true
          : `${label} ${options.translate('global.isRequired')}`,
      )
    }
    const dateRangePair = findSaplingDateRangePair(options.baseTemplates.value, template.name)
    if (dateRangePair) {
      rules.push(() =>
        isSaplingDateRangeValid(dateRangePair, options.form.value)
          ? true
          : options.translate('global.invalidDateRange'),
      )
    }
    return rules
  }

  return {
    getRecommendationMessage,
    getRules,
    isFieldDisabled,
    isReferenceFieldDisabled,
    isTemplateRecommendationActive,
    isTemplateRecommended,
    isTemplateRequired,
  }
}
