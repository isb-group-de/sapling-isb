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

/** Owns drag images, insertion targets, and scrolling for the compact form preview. */
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
  let dragWheelListenerActive = false

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

  function startFieldDrag(event: DragEvent, field: EntityTemplate): void {
    draggedFieldName.value = field.name
    draggedGroupKey.value = null
    fieldDropTarget.value = {
      groupKey: normalizeGroupKey(field.formGroup ?? null),
      beforeFieldName: getNextVisibleFieldName(field),
    }
    groupDropActive.value = false
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', `field:${field.name}`)
      setDragImage(event, 'field')
    }
    activateStableDragLayout()
    addDragWheelListener()
  }

  function startGroupDrag(event: DragEvent, groupKey: string): void {
    draggedGroupKey.value = groupKey
    draggedFieldName.value = ''
    fieldDropTarget.value = null
    groupDropBeforeKey.value = getNextVisibleGroupKey(groupKey)
    groupDropActive.value = true
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', `group:${groupKey}`)
      setDragImage(event, 'group')
    }
    activateStableDragLayout()
    addDragWheelListener()
  }

  function onFieldDragOver(
    event: DragEvent,
    group: FormConfigPreviewDragGroup,
    fieldIndex: number,
  ): void {
    if (!draggedFieldName.value) return
    updateAutoScroll(event)

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
    const beforeFieldName = isPointerAfter(event)
      ? (candidates[candidateIndex + 1]?.name ?? null)
      : field.name
    fieldDropTarget.value = { groupKey: normalizeGroupKey(group.key), beforeFieldName }
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }

  function onFieldGridDragOver(event: DragEvent, groupKey: string | null): void {
    if (!draggedFieldName.value) return
    updateAutoScroll(event)
    fieldDropTarget.value = { groupKey: normalizeGroupKey(groupKey), beforeFieldName: null }
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }

  function onGroupDragOver(event: DragEvent, groupKey: string | null): void {
    if (!draggedFieldName.value && !draggedGroupKey.value) return
    updateAutoScroll(event)
    if (draggedFieldName.value) {
      fieldDropTarget.value = { groupKey: normalizeGroupKey(groupKey), beforeFieldName: null }
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      return
    }
    if (!draggedGroupKey.value || !groupKey || groupKey === draggedGroupKey.value) return

    const candidates = options.previewGroups.value.filter(
      (group) => group.key && group.key !== draggedGroupKey.value,
    )
    const candidateIndex = candidates.findIndex((group) => group.key === groupKey)
    if (candidateIndex < 0) return
    groupDropBeforeKey.value = isPointerAfter(event)
      ? (candidates[candidateIndex + 1]?.key ?? null)
      : groupKey
    groupDropActive.value = true
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }

  function onDropPreviewDragOver(event: DragEvent): void {
    if (!draggedFieldName.value && !draggedGroupKey.value) return
    updateAutoScroll(event)
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  }

  function dropOnGroup(groupKey: string | null): void {
    if (draggedGroupKey.value) {
      dropGroup()
      return
    }
    if (draggedFieldName.value && !fieldDropTarget.value) {
      fieldDropTarget.value = { groupKey: normalizeGroupKey(groupKey), beforeFieldName: null }
    }
    dropField()
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

  function isPointerAfter(event: DragEvent): boolean {
    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return false
    const bounds = target.getBoundingClientRect()
    const verticalOffset = event.clientY - bounds.top
    if (verticalOffset > bounds.height * 0.7) return true
    if (verticalOffset < bounds.height * 0.3) return false
    return event.clientX > bounds.left + bounds.width / 2
  }

  function setDragImage(event: DragEvent, kind: 'field' | 'group'): void {
    const currentTarget = event.currentTarget
    if (!(currentTarget instanceof HTMLElement) || !event.dataTransfer) return
    clearDragImage()

    const source =
      kind === 'group'
        ? currentTarget
            .closest('.sapling-form-config-preview__group')
            ?.querySelector<HTMLElement>('.sapling-form-config-preview__group-header')
        : currentTarget
    if (!source) return

    const dragImage = source.cloneNode(true) as HTMLElement
    dragImage.classList.add('sapling-form-config-drag-image')
    dragImage.style.width = `${Math.min(Math.max(source.offsetWidth, 220), 420)}px`
    document.body.appendChild(dragImage)
    dragImageElement.value = dragImage
    event.dataTransfer.setDragImage(dragImage, Math.min(source.offsetWidth / 2, 180), 28)
  }

  function clearDragImage(): void {
    dragImageElement.value?.remove()
    dragImageElement.value = null
  }

  function updateAutoScroll(event: DragEvent): void {
    const scrollElement = getPreviewScrollElement()
    if (!scrollElement) return
    const bounds = scrollElement.getBoundingClientRect()
    if (bounds.height <= 0) return

    const edgeSize = Math.min(88, bounds.height * 0.24)
    if (event.clientY < bounds.top + edgeSize) {
      autoScrollSpeed.value = -Math.max(
        3,
        ((bounds.top + edgeSize - event.clientY) / edgeSize) * 18,
      )
    } else if (event.clientY > bounds.bottom - edgeSize) {
      autoScrollSpeed.value = Math.max(
        3,
        ((event.clientY - (bounds.bottom - edgeSize)) / edgeSize) * 18,
      )
    } else {
      autoScrollSpeed.value = 0
    }
    startAutoScrollLoop()
  }

  function startAutoScrollLoop(): void {
    if (autoScrollFrame != null || !autoScrollSpeed.value) return
    autoScrollFrame = window.requestAnimationFrame(() => {
      autoScrollFrame = null
      const scrollElement = getPreviewScrollElement()
      if (scrollElement && autoScrollSpeed.value) {
        const previousScrollTop = scrollElement.scrollTop
        scrollElement.scrollTop += autoScrollSpeed.value
        if (scrollElement.scrollTop === previousScrollTop) {
          autoScrollSpeed.value = 0
        } else {
          startAutoScrollLoop()
        }
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
    scrollElement.scrollTop += event.deltaY
    event.preventDefault()
  }

  function getPreviewScrollElement(): HTMLElement | null {
    const surface = previewSurfaceRef.value
    if (surface instanceof HTMLElement) return surface
    return surface?.$el instanceof HTMLElement ? surface.$el : null
  }

  function addDragWheelListener(): void {
    if (dragWheelListenerActive) return
    window.addEventListener('wheel', onDragWheel, { capture: true, passive: false })
    dragWheelListenerActive = true
  }

  function removeDragWheelListener(): void {
    if (!dragWheelListenerActive) return
    window.removeEventListener('wheel', onDragWheel, true)
    dragWheelListenerActive = false
  }

  function endDrag(): void {
    draggedFieldName.value = ''
    draggedGroupKey.value = null
    fieldDropTarget.value = null
    groupDropBeforeKey.value = null
    groupDropActive.value = false
    dragLayoutActive.value = false
    autoScrollSpeed.value = 0
    if (autoScrollFrame != null) window.cancelAnimationFrame(autoScrollFrame)
    autoScrollFrame = null
    if (dragLayoutFrame != null) window.cancelAnimationFrame(dragLayoutFrame)
    dragLayoutFrame = null
    clearDragImage()
    removeDragWheelListener()
  }

  onBeforeUnmount(endDrag)

  return {
    draggedFieldName,
    draggedFieldWidth,
    draggedGroupKey,
    dragLayoutActive,
    dropField,
    dropOnGroup,
    endDrag,
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
