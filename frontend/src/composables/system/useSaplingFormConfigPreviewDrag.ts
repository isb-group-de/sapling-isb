import { computed, onBeforeUnmount, ref, type ComputedRef } from 'vue'
import type { EntityTemplate, EntityTemplateFormWidth } from '@/entity/structure'

export interface FormConfigPreviewDragGroup {
  key: string | null
  templates: EntityTemplate[]
}

interface UseSaplingFormConfigPreviewDragOptions {
  draftTemplates: () => EntityTemplate[]
  previewGroups: ComputedRef<FormConfigPreviewDragGroup[]>
  getPreviewWidth: (template: EntityTemplate) => EntityTemplateFormWidth
  moveField: (fieldName: string, targetGroupKey: string, beforeFieldName: string | null) => void
  reorderGroup: (sourceKey: string, targetKey: string, placement: 'before' | 'after') => void
}

interface VisibleBounds {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

/** Owns pointer dragging, insertion targets, and nested scrolling for the compact form preview. */
export function useSaplingFormConfigPreviewDrag(options: UseSaplingFormConfigPreviewDragOptions) {
  const previewSurfaceRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
  const draggedFieldName = ref('')
  const draggedGroupKey = ref<string | null>(null)
  const fieldDropTarget = ref<{ groupKey: string; beforeFieldName: string | null } | null>(null)
  const groupDropBeforeKey = ref<string | null>(null)
  const groupDropActive = ref(false)
  const dragLayoutActive = ref(false)
  const dragImageElement = ref<HTMLElement | null>(null)
  const autoScrollSpeed = ref(0)
  let autoScrollFrame: number | null = null
  let dragLayoutFrame: number | null = null
  let globalDragListenersActive = false
  let lastPointerX = 0
  let lastPointerY = 0

  const draggedFieldWidth = computed<EntityTemplateFormWidth>(() => {
    const template = options
      .draftTemplates()
      .find((candidate) => candidate.name === draggedFieldName.value)
    return template ? options.getPreviewWidth(template) : 2
  })

  const shouldShowGroupDropAtEnd = computed(
    () => Boolean(draggedGroupKey.value && groupDropActive.value) && !groupDropBeforeKey.value,
  )

  function normalizeGroupKey(groupKey: string | null): string {
    return groupKey ?? ''
  }

  function startFieldDrag(event: PointerEvent, field: EntityTemplate): void {
    if (event.button !== 0) return
    event.preventDefault()
    rememberPointer(event)
    draggedFieldName.value = field.name
    draggedGroupKey.value = null
    fieldDropTarget.value = {
      groupKey: normalizeGroupKey(field.formGroup ?? null),
      beforeFieldName: getNextVisibleFieldName(field),
    }
    groupDropActive.value = false
    setPointerDragImage(event, 'field')
    activateStableDragLayout()
    addGlobalDragListeners()
  }

  function startGroupDrag(event: PointerEvent, groupKey: string): void {
    if (event.button !== 0) return
    event.preventDefault()
    rememberPointer(event)
    draggedGroupKey.value = groupKey
    draggedFieldName.value = ''
    fieldDropTarget.value = null
    groupDropBeforeKey.value = getNextVisibleGroupKey(groupKey)
    groupDropActive.value = true
    setPointerDragImage(event, 'group')
    activateStableDragLayout()
    addGlobalDragListeners()
  }

  function onFieldDragOver(
    event: PointerEvent,
    group: FormConfigPreviewDragGroup,
    fieldIndex: number,
  ): void {
    if (!draggedFieldName.value) return
    updateAutoScroll(event)
    updateFieldDropTarget(group, fieldIndex, event.currentTarget, event.clientX, event.clientY)
  }

  function updateFieldDropTarget(
    group: FormConfigPreviewDragGroup,
    fieldIndex: number,
    target: EventTarget | null,
    clientX: number,
    clientY: number,
  ): void {
    const field = group.templates[fieldIndex]
    if (!field) return
    if (field.name === draggedFieldName.value) {
      fieldDropTarget.value = {
        groupKey: normalizeGroupKey(group.key),
        beforeFieldName:
          group.templates
            .slice(fieldIndex + 1)
            .find((candidate) => candidate.name !== draggedFieldName.value)?.name ?? null,
      }
      return
    }

    const candidates = group.templates.filter(
      (candidate) => candidate.name !== draggedFieldName.value,
    )
    const candidateIndex = candidates.findIndex((candidate) => candidate.name === field.name)
    const beforeFieldName = isPointerAfter(target, clientX, clientY)
      ? (candidates[candidateIndex + 1]?.name ?? null)
      : field.name
    fieldDropTarget.value = { groupKey: normalizeGroupKey(group.key), beforeFieldName }
  }

  function onFieldGridDragOver(event: PointerEvent, groupKey: string | null): void {
    if (!draggedFieldName.value) return
    updateAutoScroll(event)
    fieldDropTarget.value = { groupKey: normalizeGroupKey(groupKey), beforeFieldName: null }
  }

  function onGroupDragOver(event: PointerEvent, groupKey: string | null): void {
    if (!draggedFieldName.value && !draggedGroupKey.value) return
    updateAutoScroll(event)
    if (draggedFieldName.value) {
      fieldDropTarget.value = { groupKey: normalizeGroupKey(groupKey), beforeFieldName: null }
      return
    }
    updateGroupDropTarget(groupKey, event.currentTarget, event.clientX, event.clientY)
  }

  function updateGroupDropTarget(
    groupKey: string | null,
    target: EventTarget | null,
    clientX: number,
    clientY: number,
  ): void {
    if (!draggedGroupKey.value || !groupKey || groupKey === draggedGroupKey.value) return

    const candidates = options.previewGroups.value.filter(
      (group) => group.key && group.key !== draggedGroupKey.value,
    )
    const candidateIndex = candidates.findIndex((group) => group.key === groupKey)
    if (candidateIndex < 0) return
    groupDropBeforeKey.value = isPointerAfter(target, clientX, clientY)
      ? (candidates[candidateIndex + 1]?.key ?? null)
      : groupKey
    groupDropActive.value = true
  }

  function onDropPreviewDragOver(event: PointerEvent): void {
    if (!draggedFieldName.value && !draggedGroupKey.value) return
    updateAutoScroll(event)
  }

  function dropField(): void {
    const fieldName = draggedFieldName.value
    const target = fieldDropTarget.value
    if (fieldName && target) {
      options.moveField(fieldName, target.groupKey, target.beforeFieldName)
    }
    endDrag()
  }

  function dropGroup(): void {
    const sourceKey = draggedGroupKey.value
    if (!sourceKey || !groupDropActive.value) {
      endDrag()
      return
    }

    if (groupDropBeforeKey.value) {
      options.reorderGroup(sourceKey, groupDropBeforeKey.value, 'before')
    } else {
      const lastTarget = [...options.previewGroups.value]
        .reverse()
        .find((group) => group.key && group.key !== sourceKey)?.key
      if (lastTarget) options.reorderGroup(sourceKey, lastTarget, 'after')
    }
    endDrag()
  }

  function shouldShowFieldDropBefore(groupKey: string | null, fieldName: string): boolean {
    return Boolean(
      draggedFieldName.value &&
      fieldDropTarget.value?.groupKey === normalizeGroupKey(groupKey) &&
      fieldDropTarget.value.beforeFieldName === fieldName,
    )
  }

  function shouldShowFieldDropAtEnd(groupKey: string | null): boolean {
    return Boolean(
      draggedFieldName.value &&
      fieldDropTarget.value?.groupKey === normalizeGroupKey(groupKey) &&
      fieldDropTarget.value.beforeFieldName === null,
    )
  }

  function shouldShowGroupDropBefore(groupKey: string | null): boolean {
    return Boolean(
      draggedGroupKey.value &&
      groupDropActive.value &&
      groupKey &&
      groupDropBeforeKey.value === groupKey,
    )
  }

  function getNextVisibleFieldName(field: EntityTemplate): string | null {
    const group = options.previewGroups.value.find((candidate) =>
      candidate.templates.some((template) => template.name === field.name),
    )
    const index = group?.templates.findIndex((template) => template.name === field.name) ?? -1
    return index >= 0 ? (group?.templates[index + 1]?.name ?? null) : null
  }

  function getNextVisibleGroupKey(groupKey: string): string | null {
    const groups = options.previewGroups.value.filter((group) => group.key)
    const index = groups.findIndex((group) => group.key === groupKey)
    return index >= 0 ? (groups[index + 1]?.key ?? null) : null
  }

  function isPointerAfter(target: EventTarget | null, clientX: number, clientY: number): boolean {
    if (!(target instanceof HTMLElement)) return false
    const bounds = target.getBoundingClientRect()
    const verticalOffset = clientY - bounds.top
    if (verticalOffset > bounds.height * 0.7) return true
    if (verticalOffset < bounds.height * 0.3) return false
    return clientX > bounds.left + bounds.width / 2
  }

  function setPointerDragImage(event: PointerEvent, kind: 'field' | 'group'): void {
    const currentTarget = event.currentTarget
    if (!(currentTarget instanceof HTMLElement)) return
    clearDragImage()

    const source =
      kind === 'group'
        ? currentTarget
            .closest('.sapling-form-config-preview__group')
            ?.querySelector<HTMLElement>('.sapling-form-config-preview__group-header')
        : currentTarget
    if (!source) return

    const dragImage = source.cloneNode(true) as HTMLElement
    dragImage.classList.add(
      'sapling-form-config-drag-image',
      'sapling-form-config-drag-image--pointer',
    )
    dragImage.style.width = `${Math.min(Math.max(source.offsetWidth, 220), 420)}px`
    document.body.appendChild(dragImage)
    dragImageElement.value = dragImage
    positionDragImage(event.clientX, event.clientY)
  }

  function positionDragImage(clientX: number, clientY: number): void {
    const dragImage = dragImageElement.value
    if (!dragImage) return
    dragImage.style.setProperty('--sapling-form-config-drag-x', `${clientX + 16}px`)
    dragImage.style.setProperty('--sapling-form-config-drag-y', `${clientY + 16}px`)
  }

  function clearDragImage(): void {
    dragImageElement.value?.remove()
    dragImageElement.value = null
  }

  function updateAutoScroll(event: Pick<PointerEvent, 'clientX' | 'clientY'>): void {
    const scrollElement = getPreviewScrollElement()
    if (!scrollElement) return
    const bounds = getVisiblePreviewBounds(scrollElement)
    if (bounds.height <= 0 || bounds.width <= 0) return

    const horizontalTolerance = Math.min(48, bounds.width * 0.08)
    if (
      event.clientX < bounds.left - horizontalTolerance ||
      event.clientX > bounds.right + horizontalTolerance
    ) {
      stopAutoScroll()
      return
    }

    const edgeSize = Math.min(88, bounds.height * 0.24)
    if (event.clientY < bounds.top + edgeSize) {
      const intensity = Math.min(1, (bounds.top + edgeSize - event.clientY) / edgeSize)
      autoScrollSpeed.value = -Math.max(3, intensity * 18)
    } else if (event.clientY > bounds.bottom - edgeSize) {
      const intensity = Math.min(1, (event.clientY - (bounds.bottom - edgeSize)) / edgeSize)
      autoScrollSpeed.value = Math.max(3, intensity * 18)
    } else {
      stopAutoScroll()
      return
    }
    startAutoScrollLoop()
  }

  function getVisiblePreviewBounds(scrollElement: HTMLElement): VisibleBounds {
    const bounds = scrollElement.getBoundingClientRect()
    let top = Math.max(0, bounds.top)
    let right = Math.min(window.innerWidth, bounds.right)
    let bottom = Math.min(window.innerHeight, bounds.bottom)
    let left = Math.max(0, bounds.left)
    let ancestor = scrollElement.parentElement

    while (ancestor) {
      const style = window.getComputedStyle(ancestor)
      const ancestorBounds = ancestor.getBoundingClientRect()
      if (['hidden', 'clip', 'auto', 'scroll', 'overlay'].includes(style.overflowY)) {
        top = Math.max(top, ancestorBounds.top)
        bottom = Math.min(bottom, ancestorBounds.bottom)
      }
      if (['hidden', 'clip', 'auto', 'scroll', 'overlay'].includes(style.overflowX)) {
        left = Math.max(left, ancestorBounds.left)
        right = Math.min(right, ancestorBounds.right)
      }
      ancestor = ancestor.parentElement
    }

    return {
      top,
      right,
      bottom,
      left,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    }
  }

  function getScrollChain(): HTMLElement[] {
    const preview = getPreviewScrollElement()
    if (!preview) return []
    const chain: HTMLElement[] = []
    let element: HTMLElement | null = preview

    while (element) {
      const style = window.getComputedStyle(element)
      if (
        element.scrollHeight > element.clientHeight + 1 &&
        (element === preview || ['auto', 'scroll', 'overlay'].includes(style.overflowY))
      ) {
        chain.push(element)
      }
      element = element.parentElement
    }

    return chain
  }

  function scrollChainBy(deltaY: number): boolean {
    let remaining = deltaY
    let moved = false

    for (const element of getScrollChain()) {
      const previousScrollTop = element.scrollTop
      const maximumScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
      element.scrollTop = Math.min(maximumScrollTop, Math.max(0, previousScrollTop + remaining))
      const applied = element.scrollTop - previousScrollTop
      if (applied) moved = true
      remaining -= applied
      if (Math.abs(remaining) < 0.5) break
    }

    return moved
  }

  function stopAutoScroll(): void {
    autoScrollSpeed.value = 0
    if (autoScrollFrame != null) window.cancelAnimationFrame(autoScrollFrame)
    autoScrollFrame = null
  }

  function startAutoScrollLoop(): void {
    if (autoScrollFrame != null || !autoScrollSpeed.value) return
    autoScrollFrame = window.requestAnimationFrame(() => {
      autoScrollFrame = null
      if (!autoScrollSpeed.value) return
      if (scrollChainBy(autoScrollSpeed.value)) {
        refreshDropTargetAtPoint(lastPointerX, lastPointerY)
        startAutoScrollLoop()
      } else {
        autoScrollSpeed.value = 0
      }
    })
  }

  function activateStableDragLayout(): void {
    dragLayoutActive.value = false
    if (dragLayoutFrame != null) window.cancelAnimationFrame(dragLayoutFrame)
    dragLayoutFrame = window.requestAnimationFrame(() => {
      dragLayoutFrame = null
      if (draggedFieldName.value || draggedGroupKey.value) {
        dragLayoutActive.value = true
      }
    })
  }

  function onDragWheel(event: WheelEvent): void {
    if (!draggedFieldName.value && !draggedGroupKey.value) return
    const scrollElement = getPreviewScrollElement()
    if (!scrollElement || !event.deltaY) return
    const bounds = getVisiblePreviewBounds(scrollElement)
    if (!isPointInsideBounds(event.clientX, event.clientY, bounds)) return
    if (scrollChainBy(event.deltaY)) {
      event.preventDefault()
      refreshDropTargetAtPoint(event.clientX, event.clientY)
    }
  }

  function onGlobalPointerMove(event: PointerEvent): void {
    if (!draggedFieldName.value && !draggedGroupKey.value) return
    event.preventDefault()
    rememberPointer(event)
    positionDragImage(event.clientX, event.clientY)
    updateAutoScroll(event)
    refreshDropTargetAtPoint(event.clientX, event.clientY)
  }

  function onGlobalPointerUp(event: PointerEvent): void {
    if (!draggedFieldName.value && !draggedGroupKey.value) return
    rememberPointer(event)
    if (!isPointInsidePreview(event.clientX, event.clientY)) {
      endDrag()
      return
    }
    if (draggedGroupKey.value) dropGroup()
    else dropField()
  }

  function rememberPointer(event: Pick<PointerEvent, 'clientX' | 'clientY'>): void {
    lastPointerX = event.clientX
    lastPointerY = event.clientY
  }

  function refreshDropTargetAtPoint(clientX: number, clientY: number): void {
    const preview = getPreviewScrollElement()
    const target = document.elementFromPoint?.(clientX, clientY)
    if (!preview || !(target instanceof HTMLElement) || !preview.contains(target)) return

    const groupElement = target.closest<HTMLElement>('[data-preview-group]')
    if (!groupElement) return
    const groupKey = groupElement.dataset.previewGroup || null

    if (draggedFieldName.value) {
      const fieldElement = target.closest<HTMLElement>('[data-preview-field]')
      const group = options.previewGroups.value.find(
        (candidate) => normalizeGroupKey(candidate.key) === normalizeGroupKey(groupKey),
      )
      const fieldIndex = fieldElement
        ? (group?.templates.findIndex(
            (template) => template.name === fieldElement.dataset.previewField,
          ) ?? -1)
        : -1
      if (group && fieldIndex >= 0 && fieldElement) {
        updateFieldDropTarget(group, fieldIndex, fieldElement, clientX, clientY)
      } else {
        fieldDropTarget.value = { groupKey: normalizeGroupKey(groupKey), beforeFieldName: null }
      }
      return
    }

    updateGroupDropTarget(groupKey, groupElement, clientX, clientY)
  }

  function isPointInsidePreview(clientX: number, clientY: number): boolean {
    const preview = getPreviewScrollElement()
    if (!preview) return false
    return isPointInsideBounds(clientX, clientY, getVisiblePreviewBounds(preview))
  }

  function isPointInsideBounds(clientX: number, clientY: number, bounds: VisibleBounds): boolean {
    return (
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom
    )
  }

  function onWindowBlur(): void {
    endDrag()
  }

  function onVisibilityChange(): void {
    if (document.hidden) endDrag()
  }

  function onDragKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') endDrag()
  }

  function getPreviewScrollElement(): HTMLElement | null {
    const surface = previewSurfaceRef.value
    if (surface instanceof HTMLElement) return surface
    return surface?.$el instanceof HTMLElement ? surface.$el : null
  }

  function addGlobalDragListeners(): void {
    if (globalDragListenersActive) return
    window.addEventListener('pointermove', onGlobalPointerMove, { capture: true, passive: false })
    window.addEventListener('pointerup', onGlobalPointerUp, true)
    window.addEventListener('pointercancel', endDrag, true)
    window.addEventListener('wheel', onDragWheel, { capture: true, passive: false })
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('keydown', onDragKeyDown, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    globalDragListenersActive = true
  }

  function removeGlobalDragListeners(): void {
    if (!globalDragListenersActive) return
    window.removeEventListener('pointermove', onGlobalPointerMove, true)
    window.removeEventListener('pointerup', onGlobalPointerUp, true)
    window.removeEventListener('pointercancel', endDrag, true)
    window.removeEventListener('wheel', onDragWheel, true)
    window.removeEventListener('blur', onWindowBlur)
    window.removeEventListener('keydown', onDragKeyDown, true)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    globalDragListenersActive = false
  }

  function endDrag(): void {
    draggedFieldName.value = ''
    draggedGroupKey.value = null
    fieldDropTarget.value = null
    groupDropBeforeKey.value = null
    groupDropActive.value = false
    dragLayoutActive.value = false
    stopAutoScroll()
    if (dragLayoutFrame != null) window.cancelAnimationFrame(dragLayoutFrame)
    dragLayoutFrame = null
    clearDragImage()
    removeGlobalDragListeners()
  }

  onBeforeUnmount(endDrag)

  return {
    draggedFieldName,
    draggedFieldWidth,
    draggedGroupKey,
    dragLayoutActive,
    fieldDropTarget,
    normalizeGroupKey,
    onFieldDragOver,
    onFieldGridDragOver,
    onGroupDragOver,
    onDropPreviewDragOver,
    previewSurfaceRef,
    shouldShowFieldDropAtEnd,
    shouldShowFieldDropBefore,
    shouldShowGroupDropAtEnd,
    shouldShowGroupDropBefore,
    startFieldDrag,
    startGroupDrag,
  }
}
