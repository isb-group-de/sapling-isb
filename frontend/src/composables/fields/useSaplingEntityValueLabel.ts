import { ref, watch, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import ApiTemplateService from '@/services/api.template.service'
import {
  getEntityValueLabel,
  getEntityValueLabelLines,
  type EntityValueLabelLine,
  type EntityValueReferenceTemplates,
} from '@/utils/saplingTableUtil'

export function useSaplingEntityValueLabel(entityTemplates: Ref<EntityTemplate[]>) {
  const referenceTemplates = ref<EntityValueReferenceTemplates>({})
  let requestId = 0

  watch(
    () => entityTemplates.value,
    async (templates) => {
      const currentRequestId = ++requestId
      const referenceNames = [
        ...new Set(
          (templates ?? [])
            .filter(
              (template) =>
                template.isReference &&
                template.options?.includes('isValue') &&
                Boolean(template.referenceName),
            )
            .map((template) => template.referenceName as string),
        ),
      ]

      if (referenceNames.length === 0) {
        referenceTemplates.value = {}
        return
      }

      const loadedTemplates = await Promise.all(
        referenceNames.map(async (referenceName) => {
          try {
            return [
              referenceName,
              await ApiTemplateService.getEntityTemplate(referenceName),
            ] as const
          } catch {
            return [referenceName, []] as const
          }
        }),
      )

      if (currentRequestId === requestId) {
        referenceTemplates.value = Object.fromEntries(loadedTemplates)
      }
    },
    { immediate: true },
  )

  function getValueLabel(item?: SaplingGenericItem | null): string {
    return getEntityValueLabel(item, entityTemplates.value, referenceTemplates.value)
  }

  function getValueLabelLines(item?: SaplingGenericItem | null): EntityValueLabelLine[] {
    return getEntityValueLabelLines(item, entityTemplates.value, referenceTemplates.value)
  }

  return { getValueLabel, getValueLabelLines }
}
