import { ref } from 'vue'

/** Native drag-and-drop state with a Kanban-style floating preview. */
export function useSaplingSortableDrag(
  onMove: (draggedHandle: number, targetHandle: number) => void,
) {
  const draggedHandle = ref<number | null>(null)
  const dropTargetHandle = ref<number | null>(null)
  let dragPreview: HTMLElement | null = null

  function clearPreview() {
    dragPreview?.remove()
    dragPreview = null
  }

  function start(event: DragEvent, handle: number) {
    const source = event.currentTarget as HTMLElement | null
    if (!source || !event.dataTransfer) {
      return
    }

    draggedHandle.value = handle
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(handle))
    dragPreview = source.cloneNode(true) as HTMLElement
    dragPreview.classList.add('sapling-sortable-drag-preview')
    dragPreview.style.width = `${source.getBoundingClientRect().width}px`
    document.body.appendChild(dragPreview)
    event.dataTransfer.setDragImage(
      dragPreview,
      Math.min(32, source.clientWidth / 2),
      Math.min(24, source.clientHeight / 2),
    )
  }

  function enter(event: DragEvent, targetHandle: number) {
    event.preventDefault()
    if (draggedHandle.value == null || draggedHandle.value === targetHandle) {
      return
    }

    dropTargetHandle.value = targetHandle
    onMove(draggedHandle.value, targetHandle)
  }

  function over(event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  function finish(event?: DragEvent) {
    event?.preventDefault()
    draggedHandle.value = null
    dropTargetHandle.value = null
    clearPreview()
  }

  return { draggedHandle, dropTargetHandle, start, enter, over, finish }
}
