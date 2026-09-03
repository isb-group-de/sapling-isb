import type { ComputedRef, Ref } from 'vue'
import type { DialogSaveContext, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'

const PENDING_RELATION_DRAFT_KEY = '__saplingPendingRelationDraftId'
type GetItemHandle = (item?: SaplingGenericItem | null) => string | number | null

export function useSaplingPendingRelations(options: {
  hasPendingRelationParent: ComputedRef<boolean>
  relationTemplates: ComputedRef<EntityTemplate[]>
  relationTableItems: Ref<Record<string, SaplingGenericItem[]>>
  relationTableTotal: Ref<Record<string, number>>
  relationTableLoaded: Ref<Record<string, boolean>>
  selectedRelations: Ref<Record<string, SaplingGenericItem[]>>
  getItemHandle: GetItemHandle
  getDirtyRelationNames: () => string[]
}) {
  const pendingRelationCreateContexts = new Map<string, DialogSaveContext>()
  let nextPendingRelationDraftId = 1

  function getPendingRelationDraftId(item: SaplingGenericItem): string | null {
    const value = item[PENDING_RELATION_DRAFT_KEY]
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  function getStagedRelationIdentity(item: SaplingGenericItem): string | null {
    const draftId = getPendingRelationDraftId(item)
    if (draftId) return `draft:${draftId}`
    const handle = options.getItemHandle(item)
    return handle == null ? null : `handle:${String(handle)}`
  }

  function haveSameRelationIdentities(
    stagedItems: SaplingGenericItem[],
    initialValue: unknown,
  ): boolean {
    const stagedIdentities = stagedItems
      .map(getStagedRelationIdentity)
      .filter((identity): identity is string => Boolean(identity))
      .sort()
    const initialIdentities = (Array.isArray(initialValue) ? initialValue : [])
      .flatMap((item) => {
        if (item && typeof item === 'object') {
          return [getStagedRelationIdentity(item as SaplingGenericItem)]
        }
        return typeof item === 'string' || typeof item === 'number'
          ? [`handle:${String(item)}`]
          : []
      })
      .filter((identity): identity is string => Boolean(identity))
      .sort()
    return (
      stagedIdentities.length === initialIdentities.length &&
      stagedIdentities.every((identity, index) => identity === initialIdentities[index])
    )
  }

  function stageNewRelationRecord(
    template: EntityTemplate,
    item: SaplingGenericItem,
    context?: DialogSaveContext,
    sourceDraft?: SaplingGenericItem,
  ): void {
    if (!options.hasPendingRelationParent.value || template.kind !== '1:m') return
    const existingDraftId = sourceDraft ? getPendingRelationDraftId(sourceDraft) : null
    const draftId = existingDraftId ?? `${template.name}:${nextPendingRelationDraftId++}`
    const draft = { ...item, [PENDING_RELATION_DRAFT_KEY]: draftId }
    const stagedItems = options.relationTableItems.value[template.name] ?? []
    const existingIndex = existingDraftId
      ? stagedItems.findIndex(
          (stagedItem) => getPendingRelationDraftId(stagedItem) === existingDraftId,
        )
      : -1
    options.relationTableItems.value[template.name] =
      existingIndex >= 0
        ? stagedItems.map((stagedItem, index) => (index === existingIndex ? draft : stagedItem))
        : [...stagedItems, draft]
    options.relationTableTotal.value[template.name] =
      options.relationTableItems.value[template.name].length
    options.relationTableLoaded.value[template.name] = true
    if (context) pendingRelationCreateContexts.set(draftId, context)
  }

  function stageRelations(template: EntityTemplate, items: SaplingGenericItem[]): void {
    const staged = options.relationTableItems.value[template.name] ?? []
    const handles = new Set(
      staged
        .map((item) => options.getItemHandle(item))
        .filter((handle): handle is string | number => handle != null),
    )
    options.relationTableItems.value[template.name] = [
      ...staged,
      ...items.filter((item) => {
        const handle = options.getItemHandle(item)
        if (handle == null || handles.has(handle)) return false
        handles.add(handle)
        return true
      }),
    ]
    options.relationTableTotal.value[template.name] =
      options.relationTableItems.value[template.name].length
    options.relationTableLoaded.value[template.name] = true
  }

  function appendPendingRelationsToPayload(payload: SaplingGenericItem): SaplingGenericItem {
    if (!options.hasPendingRelationParent.value) return payload
    const output = { ...payload }
    options.relationTemplates.value
      .filter((template) => ['m:n', 'n:m'].includes(template.kind ?? ''))
      .forEach((template) => {
        const handles = (options.relationTableItems.value[template.name] ?? [])
          .map((item) => options.getItemHandle(item))
          .filter((handle): handle is string | number => handle != null)
        const hasPayloadValue = Object.prototype.hasOwnProperty.call(output, template.name)
        const wasChanged = options.getDirtyRelationNames().includes(template.name)
        if (handles.length > 0 || hasPayloadValue || wasChanged) output[template.name] = handles
      })
    return output
  }

  async function persistPendingRelations(parentHandle: string | number): Promise<boolean> {
    let allPersisted = true
    for (const template of options.relationTemplates.value.filter(
      (entry) => entry.kind === '1:m',
    )) {
      const pending = options.relationTableItems.value[template.name] ?? []
      const mappedBy = template.mappedBy
      if (!mappedBy || pending.length === 0) continue
      const failed: SaplingGenericItem[] = []
      for (let index = 0; index < pending.length; index += 1) {
        let item = pending[index]
        let handle = options.getItemHandle(item)
        const draftId = getPendingRelationDraftId(item)
        try {
          if (handle == null) {
            const createPayload = { ...item, [mappedBy]: parentHandle }
            delete createPayload[PENDING_RELATION_DRAFT_KEY]
            const created = await ApiGenericService.create(
              template.referenceName ?? '',
              createPayload,
            )
            handle = options.getItemHandle(created)
            if (handle == null) throw new Error('Created relation record has no handle')
            item = { ...item, ...created }
            pending[index] = item
          } else {
            await ApiGenericService.update(template.referenceName ?? '', handle, {
              [mappedBy]: parentHandle,
            })
          }
          const nestedPersisted =
            (draftId && handle != null
              ? await pendingRelationCreateContexts.get(draftId)?.persistPendingRelations?.(handle)
              : undefined) ?? true
          if (!nestedPersisted) {
            failed.push(item, ...pending.slice(index + 1))
            break
          }
          if (draftId) pendingRelationCreateContexts.delete(draftId)
        } catch {
          failed.push(item, ...pending.slice(index + 1))
          break
        }
      }
      options.relationTableItems.value[template.name] = failed
      options.relationTableTotal.value[template.name] = failed.length
      options.selectedRelations.value[template.name] = failed
      allPersisted = allPersisted && failed.length === 0
    }
    return allPersisted
  }

  function clearPendingRelationContexts(): void {
    pendingRelationCreateContexts.clear()
  }

  function discardPendingRelation(item: SaplingGenericItem): void {
    const draftId = getPendingRelationDraftId(item)
    if (draftId) pendingRelationCreateContexts.delete(draftId)
  }

  return {
    appendPendingRelationsToPayload,
    clearPendingRelationContexts,
    discardPendingRelation,
    getStagedRelationIdentity,
    haveSameRelationIdentities,
    persistPendingRelations,
    stageNewRelationRecord,
    stageRelations,
  }
}
