import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSaplingSortableDrag } from '../useSaplingSortableDrag'

function createDragEvent(source: HTMLElement): DragEvent {
  return {
    currentTarget: source,
    clientX: 1150,
    clientY: 460,
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
      setDragImage: vi.fn(),
    },
  } as unknown as DragEvent
}

describe('useSaplingSortableDrag', () => {
  afterEach(() => {
    document
      .querySelectorAll('.sapling-sortable-drag-preview')
      .forEach((element) => element.remove())
  })

  it('creates a drag preview, reports live moves, and clears all state on drop', () => {
    const move = vi.fn()
    const drag = useSaplingSortableDrag(move)
    const source = document.createElement('div')
    Object.defineProperty(source, 'clientWidth', { value: 240 })
    Object.defineProperty(source, 'clientHeight', { value: 120 })
    source.getBoundingClientRect = () =>
      ({ left: 1000, top: 400, width: 240, height: 120 }) as DOMRect
    const event = createDragEvent(source)

    drag.start(event, 7)
    drag.enter(event, 9)

    expect(drag.draggedHandle.value).toBe(7)
    expect(drag.dropTargetHandle.value).toBe(9)
    expect(move).toHaveBeenCalledWith(7, 9)
    expect(document.querySelector('.sapling-sortable-drag-preview')).not.toBeNull()
    const preview = document.querySelector<HTMLElement>('.sapling-sortable-drag-preview')!
    expect(event.dataTransfer!.setDragImage).toHaveBeenCalledWith(preview, 150, 60)
    expect(preview.style.getPropertyValue('--sapling-sortable-drag-preview-width')).toBe('240px')
    expect(preview.style.getPropertyValue('--sapling-sortable-drag-preview-height')).toBe('120px')

    drag.finish(event)

    expect(drag.draggedHandle.value).toBeNull()
    expect(drag.dropTargetHandle.value).toBeNull()
    expect(document.querySelector('.sapling-sortable-drag-preview')).toBeNull()
  })

  it('replaces an interrupted preview and clamps the pointer to the source bounds', () => {
    const drag = useSaplingSortableDrag(vi.fn())
    const source = document.createElement('div')
    source.getBoundingClientRect = () =>
      ({ left: 1200, top: 200, width: 240, height: 120 }) as DOMRect
    const event = createDragEvent(source)

    drag.start(event, 7)
    const previousPreview = document.querySelector('.sapling-sortable-drag-preview')!
    drag.start(event, 8)

    expect(previousPreview.isConnected).toBe(false)
    expect(document.querySelectorAll('.sapling-sortable-drag-preview')).toHaveLength(1)
    expect(event.dataTransfer!.setDragImage).toHaveBeenLastCalledWith(
      document.querySelector('.sapling-sortable-drag-preview'),
      0,
      120,
    )
    drag.finish()
  })
})
