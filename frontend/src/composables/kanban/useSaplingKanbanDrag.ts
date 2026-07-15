import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplateKanban } from '@/entity/structure'

type KanbanDragOptions = {
  canUpdateRecord: ComputedRef<boolean>
  records: Ref<SaplingGenericItem[]>
  kanbanConfig: ComputedRef<EntityTemplateKanban | null>
  getRecordColumnHandle: (record: SaplingGenericItem | null | undefined) => string
  moveRecord: (record: SaplingGenericItem, column: SaplingGenericItem) => Promise<void>
}

export function useSaplingKanbanDrag(options: KanbanDragOptions) {
  const draggedRecordHandle = ref<string | null>(null)
  const dropColumnHandle = ref<string | null>(null)
  const dragImageElement = ref<HTMLElement | null>(null)
  const draggedRecord = computed(() =>
    options.records.value.find((record) => String(record.handle) === draggedRecordHandle.value),
  )

  function shouldShowDropPreview(column: SaplingGenericItem): boolean {
    return Boolean(
      draggedRecord.value &&
      dropColumnHandle.value === String(column.handle) &&
      options.getRecordColumnHandle(draggedRecord.value) !== String(column.handle),
    )
  }

  function onDragStart(event: DragEvent, record: SaplingGenericItem): void {
    if (!options.canUpdateRecord.value || record.handle == null) {
      event.preventDefault()
      return
    }

    draggedRecordHandle.value = String(record.handle)
    event.dataTransfer?.setData('text/plain', String(record.handle))
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      setCardDragImage(event)
    }
  }

  function onDragOver(event: DragEvent, column: SaplingGenericItem): void {
    if (draggedRecordHandle.value != null && dropColumnHandle.value !== String(column.handle)) {
      dropColumnHandle.value = String(column.handle)
    }
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }

  function onDragEnd(): void {
    draggedRecordHandle.value = null
    dropColumnHandle.value = null
    clearCardDragImage()
  }

  async function onDrop(column: SaplingGenericItem): Promise<void> {
    const handle = draggedRecordHandle.value
    onDragEnd()
    if (handle == null || !options.canUpdateRecord.value || !options.kanbanConfig.value) {
      return
    }

    const record = options.records.value.find((entry) => String(entry.handle) === handle)
    if (!record || options.getRecordColumnHandle(record) === String(column.handle)) return
    await options.moveRecord(record, column)
  }

  function setCardDragImage(event: DragEvent): void {
    const source = event.currentTarget
    if (!(source instanceof HTMLElement) || !event.dataTransfer) return

    clearCardDragImage()
    const dragImage = source.cloneNode(true) as HTMLElement
    dragImage.classList.add('sapling-kanban-card--drag-image')
    dragImage.style.width = `${source.offsetWidth}px`
    document.body.appendChild(dragImage)
    dragImageElement.value = dragImage
    event.dataTransfer.setDragImage(dragImage, Math.min(source.offsetWidth / 2, 180), 28)
  }

  function clearCardDragImage(): void {
    dragImageElement.value?.remove()
    dragImageElement.value = null
  }

  return {
    draggedRecord,
    draggedRecordHandle,
    dropColumnHandle,
    onDragEnd,
    onDragOver,
    onDragStart,
    onDrop,
    shouldShowDropPreview,
  }
}
