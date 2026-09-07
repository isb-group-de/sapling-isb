import { onScopeDispose, shallowRef } from 'vue'
import { setCssVariables } from '@/directives/cssVars'

/** Native drag-and-drop state with a Kanban-style floating preview. */
export function useSaplingSortableDrag<T extends string | number = number>(
  onMove: (draggedHandle: T, targetHandle: T) => void,
) {
  const draggedHandle = shallowRef<T | null>(null)
  const dropTargetHandle = shallowRef<T | null>(null)
  let dragPreview: HTMLElement | null = null

  function clearPreview() {
    dragPreview?.remove()
    dragPreview = null
  }

  function start(event: DragEvent, handle: T) {
    const source = event.currentTarget as HTMLElement | null
    if (!source || !event.dataTransfer) {
      return
    }

    clearPreview()
    const bounds = source.getBoundingClientRect()
    draggedHandle.value = handle
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(handle))
    dragPreview = source.cloneNode(true) as HTMLElement
    dragPreview.classList.add('sapling-sortable-drag-preview')
    setCssVariables(dragPreview, {
      '--sapling-sortable-drag-preview-width': `${bounds.width}px`,
      '--sapling-sortable-drag-preview-height': `${bounds.height}px`,
    })
    document.body.appendChild(dragPreview)
    event.dataTransfer.setDragImage(
      dragPreview,
      Math.max(0, Math.min(event.clientX - bounds.left, bounds.width)),
      Math.max(0, Math.min(event.clientY - bounds.top, bounds.height)),
    )
  }

  function enter(event: DragEvent, targetHandle: T) {
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

  onScopeDispose(clearPreview, true)

  return { draggedHandle, dropTargetHandle, start, enter, over, finish }
}
