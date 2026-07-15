import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplateKanban } from '@/entity/structure'
import { useSaplingKanbanDrag } from '../useSaplingKanbanDrag'

function createDragEvent(): DragEvent {
  return {
    preventDefault: vi.fn(),
    currentTarget: null,
    dataTransfer: {
      setData: vi.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
    },
  } as unknown as DragEvent
}

describe('useSaplingKanbanDrag', () => {
  it('moves one allowed record to a different column and clears drag state', async () => {
    const record = { handle: 7, status: { handle: 'open' } } as SaplingGenericItem
    const target = { handle: 'done' } as SaplingGenericItem
    const moveRecord = vi.fn().mockResolvedValue(undefined)
    const drag = useSaplingKanbanDrag({
      canUpdateRecord: computed(() => true),
      records: ref([record]),
      kanbanConfig: computed(() => ({ columnField: 'status' }) as EntityTemplateKanban),
      getRecordColumnHandle: (item) =>
        String((item?.status as { handle?: unknown } | undefined)?.handle ?? ''),
      moveRecord,
    })
    const event = createDragEvent()

    drag.onDragStart(event, record)
    drag.onDragOver(event, target)
    expect(drag.draggedRecordHandle.value).toBe('7')
    expect(drag.dropColumnHandle.value).toBe('done')
    expect(drag.shouldShowDropPreview(target)).toBe(true)

    await drag.onDrop(target)

    expect(moveRecord).toHaveBeenCalledWith(record, target)
    expect(drag.draggedRecordHandle.value).toBeNull()
    expect(drag.dropColumnHandle.value).toBeNull()
  })

  it('prevents dragging when updates are not permitted', () => {
    const event = createDragEvent()
    const drag = useSaplingKanbanDrag({
      canUpdateRecord: computed(() => false),
      records: ref([]),
      kanbanConfig: computed(() => null),
      getRecordColumnHandle: () => '',
      moveRecord: vi.fn(),
    })

    drag.onDragStart(event, { handle: 7 })

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(drag.draggedRecordHandle.value).toBeNull()
  })
})
