import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSaplingDialogFocusManagement } from '../useSaplingDialogFocusManagement'
import { isQuietFieldFocus } from '@/utils/fieldFocus'

afterEach(() => vi.restoreAllMocks())

describe('dialog initial focus', () => {
  it.each(['loading', 'transition'] as const)(
    'waits for %s and focuses quietly again after reopening',
    async (lastReady) => {
      vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body)
      const props = reactive({ modelValue: true, mode: 'edit' as const })
      const isLoading = ref(true)
      const focusEvents: boolean[] = []
      let focus!: ReturnType<typeof useSaplingDialogFocusManagement>
      const wrapper = mount(
        defineComponent({
          setup() {
            focus = useSaplingDialogFocusManagement(props, {
              activeTab: ref(0),
              expandedGroupIds: ref([]),
              isLoading,
              syncExpandedGroups: vi.fn(),
              validationFeedback: ref(null),
            })
            return () =>
              props.modelValue && !isLoading.value
                ? h('div', { ref: focus.formSurfaceRef }, [
                    h('input', { disabled: true }),
                    h('input', {
                      onFocus: (event: FocusEvent) => focusEvents.push(isQuietFieldFocus(event)),
                    }),
                    h('input'),
                  ])
                : null
          },
        }),
        { attachTo: document.body },
      )
      const settle = async () => {
        await nextTick()
        await nextTick()
        await nextTick()
      }
      try {
        if (lastReady === 'loading') focus.onDialogAfterEnter()
        else isLoading.value = false
        await settle()
        expect(focusEvents).toEqual([])
        if (lastReady === 'loading') isLoading.value = false
        else focus.onDialogAfterEnter()
        await settle()
        expect(document.activeElement).toBe(wrapper.findAll('input')[1]!.element)
        expect(focusEvents).toEqual([true])
        // Ordinary subsequent keyboard focus is not suppressed.
        wrapper.findAll('input')[2]!.element.focus()
        wrapper.findAll('input')[1]!.element.focus()
        expect(focusEvents).toEqual([true, false])
        props.modelValue = false
        await settle()
        props.modelValue = true
        await settle()
        expect(focusEvents).toEqual([true, false])
        focus.onDialogAfterEnter()
        await settle()
        expect(focusEvents).toEqual([true, false, true])
      } finally {
        wrapper.unmount()
      }
    },
  )
})
