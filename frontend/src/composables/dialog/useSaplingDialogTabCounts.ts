import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import ApiGenericService from '@/services/api.generic.service'

export type SupplementalTabKind = 'information' | 'document' | 'email' | 'phoneCall'

interface CountTarget {
  entityHandle: string
  filter: Record<string, unknown>
}

interface DialogTabCountOptions {
  entityHandle: ComputedRef<string>
  hasPersistedItem: ComputedRef<boolean>
  isDialogLoading: Ref<boolean>
  itemHandle: ComputedRef<string | number | null>
  relationTemplates: ComputedRef<EntityTemplate[]>
  relationTableLoaded: Ref<Record<string, boolean>>
  relationTableTotal: Ref<Record<string, number>>
  supplementalKinds: ComputedRef<SupplementalTabKind[]>
}

export function useSaplingDialogTabCounts(options: DialogTabCountOptions) {
  const supplementalCounts = ref<Partial<Record<SupplementalTabKind, number>>>({})
  const relationCountsFromServer = ref<Record<string, number>>({})
  let requestGeneration = 0
  let abortController: AbortController | null = null

  const relationCounts = computed<Record<string, number | undefined>>(() =>
    Object.fromEntries(
      options.relationTemplates.value.map((template) => [
        template.name,
        !options.hasPersistedItem.value || options.relationTableLoaded.value[template.name]
          ? (options.relationTableTotal.value[template.name] ?? 0)
          : relationCountsFromServer.value[template.name],
      ]),
    ),
  )
  const countSignature = computed(() =>
    JSON.stringify({
      entityHandle: options.entityHandle.value,
      itemHandle: options.itemHandle.value,
      relations: options.relationTemplates.value.map((template) => [
        template.name,
        template.referenceName,
        template.mappedBy,
        template.inversedBy,
      ]),
      supplemental: options.supplementalKinds.value,
    }),
  )

  watch(
    [options.isDialogLoading, countSignature],
    ([loading]) => {
      const generation = ++requestGeneration
      abortController?.abort()
      abortController = null
      supplementalCounts.value = {}
      relationCountsFromServer.value = {}

      if (loading) return
      if (!options.hasPersistedItem.value) {
        supplementalCounts.value = Object.fromEntries(
          options.supplementalKinds.value.map((kind) => [kind, 0]),
        )
        return
      }

      void nextTick(() => loadTabCounts(generation))
    },
    { immediate: true, flush: 'post' },
  )

  async function loadTabCounts(generation: number): Promise<void> {
    const controller = new AbortController()
    abortController = controller

    await Promise.all([
      ...options.relationTemplates.value.map(async (template) => {
        const target = getRelationCountTarget(template)
        if (!target) return

        const count = await loadCount(target, controller.signal)
        if (generation === requestGeneration && count != null) {
          relationCountsFromServer.value[template.name] = count
        }
      }),
      ...options.supplementalKinds.value.map(async (kind) => {
        const target = getSupplementalCountTarget(kind)
        if (!target) return

        const count = await loadCount(target, controller.signal)
        if (generation === requestGeneration && count != null) {
          supplementalCounts.value[kind] = count
        }
      }),
    ])
  }

  async function refreshSupplementalTabCount(kind: SupplementalTabKind): Promise<void> {
    const target = getSupplementalCountTarget(kind)
    if (!target) return

    const generation = requestGeneration
    const count = await loadCount(target)
    if (generation === requestGeneration && count != null) {
      supplementalCounts.value[kind] = count
    }
  }

  function updateSupplementalTabCount(kind: SupplementalTabKind, count: number): void {
    supplementalCounts.value[kind] = Math.max(0, count)
  }

  function getRelationCountTarget(template: EntityTemplate): CountTarget | null {
    const indexKey = template.mappedBy ?? template.inversedBy
    const referenceName = template.referenceName?.trim()
    const handle = options.itemHandle.value
    if (!indexKey || !referenceName || handle == null) return null
    return { entityHandle: referenceName, filter: { [indexKey]: handle } }
  }

  function getSupplementalCountTarget(kind: SupplementalTabKind): CountTarget | null {
    const entityHandle = options.entityHandle.value.trim()
    const handle = options.itemHandle.value
    if (!entityHandle || handle == null) return null

    return {
      entityHandle: kind === 'email' ? 'emailDelivery' : kind,
      filter: {
        entity: entityHandle,
        [kind === 'email' ? 'referenceHandle' : 'reference']: String(handle),
      },
    }
  }

  async function loadCount(target: CountTarget, signal?: AbortSignal): Promise<number | null> {
    try {
      const response = await ApiGenericService.find<SaplingGenericItem>(target.entityHandle, {
        filter: target.filter,
        page: 1,
        limit: 1,
        fields: ['handle'],
        signal,
        suppressErrorMessage: true,
      })
      return response.meta?.total ?? response.data.length
    } catch {
      return null
    }
  }

  return {
    relationCounts,
    supplementalCounts,
    refreshSupplementalTabCount,
    updateSupplementalTabCount,
  }
}
