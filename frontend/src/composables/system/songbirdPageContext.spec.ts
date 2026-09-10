import { describe, expect, it } from 'vitest'
import { defineComponent, h, reactive, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import {
  useSongbirdPageContext,
  useSongbirdRecordContext,
  hasSongbirdRecordDialog,
} from './songbirdPageContext'

describe('Songbird page context', () => {
  it('tracks unsaved open dialogs for keyboard blocking without exposing form values', async () => {
    const visible = ref(true)
    const wrapper = mount(
      defineComponent({
        setup() {
          useSongbirdRecordContext(
            () => null,
            () => visible.value,
          )
          return () => h('div')
        },
      }),
    )
    expect(hasSongbirdRecordDialog.value).toBe(true)
    visible.value = false
    await nextTick()
    expect(hasSongbirdRecordDialog.value).toBe(false)
    wrapper.unmount()
  })

  it('prefers saved dialogs and clears the reference when they close', () => {
    const route = reactive({
      params: { entity: 'ticket' },
      name: 'table',
      path: '/table/ticket',
      fullPath: '/table/ticket',
    })
    const visible = ref(true)
    const page = useSongbirdPageContext(route as unknown as RouteLocationNormalizedLoaded)
    const wrapper = mount(
      defineComponent({
        setup() {
          useSongbirdRecordContext(() =>
            visible.value
              ? { entityHandle: 'company', recordHandle: '12', label: 'Company 12' }
              : null,
          )
          return () => h('div')
        },
      }),
    )
    expect(page.value.recordHandle).toBe('12')
    wrapper.unmount()
    expect(page.value.entityHandle).toBe('ticket')
    expect(page.value.recordHandle).toBeNull()
  })
  it('falls back to the preceding dialog after the topmost dialog unmounts', () => {
    const route = reactive({ params: {}, name: 'home', path: '/', fullPath: '/' })
    const page = useSongbirdPageContext(route as unknown as RouteLocationNormalizedLoaded)
    const record = (id: string) =>
      mount(
        defineComponent({
          setup() {
            useSongbirdRecordContext(() => ({
              entityHandle: 'ticket',
              recordHandle: id,
              label: id,
            }))
            return () => h('div')
          },
        }),
      )
    const first = record('1'),
      second = record('2')
    expect(page.value.recordHandle).toBe('2')
    second.unmount()
    expect(page.value.recordHandle).toBe('1')
    first.unmount()
    expect(page.value.entityHandle).toBeNull()
  })
})
