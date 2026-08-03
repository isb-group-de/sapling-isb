import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSaplingSortableDrag } from '../useSaplingSortableDrag'

function createDragEvent(source: HTMLElement): DragEvent {
  return {
    currentTarget: source,
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
    source.getBoundingClientRect = () => ({ width: 240 }) as DOMRect
    const event = createDragEvent(source)

    drag.start(event, 7)
    drag.enter(event, 9)

    expect(drag.draggedHandle.value).toBe(7)
    expect(drag.dropTargetHandle.value).toBe(9)
    expect(move).toHaveBeenCalledWith(7, 9)
    expect(document.querySelector('.sapling-sortable-drag-preview')).not.toBeNull()

    drag.finish(event)

    expect(drag.draggedHandle.value).toBeNull()
    expect(drag.dropTargetHandle.value).toBeNull()
    expect(document.querySelector('.sapling-sortable-drag-preview')).toBeNull()
  })
})
