import { ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ApiGenericService from '@/services/api.generic.service'
import ApiTemplateService from '@/services/api.template.service'
import TranslationService from '@/services/translation.service'
import { getEntityValueLabel } from '@/utils/saplingTableValueUtil'
import type { EntityTemplate } from '@/entity/structure'
import type { AutomationRule } from './automationInspection.types'

/** Fetch labels only for the bounded visible graph, using normal metadata and permissions. */
export function useAutomationLabels(rules: Ref<AutomationRule[]>) {
  const { t, te } = useI18n()
  const labels = ref<Record<string, string>>({})
  const templates: Record<string, EntityTemplate[]> = {}
  const translations = new TranslationService()
  const pending = new Map<string, Promise<EntityTemplate[]>>()
  const fieldLabel = (entity: string, field: string) =>
    te(`${entity}.${field}`) ? t(`${entity}.${field}`) : field
  const valueLabel = (entity: string, field: string, value: unknown): string => {
    if (value == null) return '—'
    return (
      labels.value[`${entity}:${field}:${String(value)}`] ??
      (typeof value === 'object' ? JSON.stringify(value) : String(value))
    )
  }
  async function load(entity: string) {
    if (!pending.has(entity))
      pending.set(
        entity,
        (async () => {
          templates[entity] = await ApiTemplateService.getEntityTemplate(entity)
          await translations.prepare(entity)
          return templates[entity]
        })(),
      )
    try {
      return await pending.get(entity)!
    } catch (error) {
      pending.delete(entity)
      throw error
    }
  }
  watch(rules, async (items) => {
    if (!items.length) return
    try {
      await Promise.all(
        [...new Set(items.flatMap((rule) => [rule.sourceEntity, rule.targetEntity]))].map(load),
      )
      const values = items.flatMap((rule) => [
        ...rule.conditions.flatMap((c) =>
          [c.oldValue, c.newValue].map((value) => ({
            entity: c.scope === 'target' ? rule.targetEntity : rule.sourceEntity,
            field: String(c.field),
            value,
          })),
        ),
        ...rule.assignments.map((a) => ({
          entity: rule.targetEntity,
          field: String(a.field),
          value: a.value,
        })),
      ])
      const unique = [
        ...new Map(
          values.map((item) => [
            `${item.entity}:${item.field}:${JSON.stringify(item.value)}`,
            item,
          ]),
        ).values(),
      ].slice(0, 200)
      await Promise.all(
        unique.map(async ({ entity, field, value }) => {
          if (typeof value !== 'string' && typeof value !== 'number') return
          const reference = templates[entity]?.find((t) => t.name === field)?.referenceName
          const key = `${entity}:${field}:${value}`
          if (!reference || labels.value[key]) return
          const metadata = await load(reference)
          const fields = metadata
            .filter((t) => t.options?.includes('isValue') && !t.isReference)
            .map((t) => t.name)
          const result = await ApiGenericService.find(reference, {
            filter: { handle: value },
            fields: [...new Set(['handle', ...fields])],
            page: 1,
            limit: 1,
            suppressErrorMessage: true,
          })
          if (result.data[0]) labels.value[key] = getEntityValueLabel(result.data[0], metadata)
        }),
      )
    } catch {
      /* Raw keys remain visible when a referenced value was deleted or is unavailable. */
    }
  })
  return { fieldLabel, valueLabel }
}
