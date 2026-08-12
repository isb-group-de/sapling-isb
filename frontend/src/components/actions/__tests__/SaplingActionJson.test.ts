import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingActionJson from '@/components/actions/SaplingActionJson.vue'

function mountAction(confirm?: () => void) {
  const cancel = vi.fn()
  const download = vi.fn()
  const wrapper = mount(SaplingActionJson, {
    props: { cancel, download, confirm },
    global: {
      mocks: {
        $t: (key: string) => key,
        $vuetify: { display: { mdAndUp: true } },
      },
      stubs: {
        SaplingActionBar: {
          template: '<div><slot name="leading" /><slot name="trailing" /></div>',
        },
        VBtn: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })

  return { wrapper, cancel, download }
}

describe('SaplingActionJson', () => {
  it('offers cancel, download and OK without implying persistence', async () => {
    const confirm = vi.fn()
    const { wrapper, cancel, download } = mountAction(confirm)
    const buttons = wrapper.findAll('button')

    expect(buttons.map((button) => button.text())).toEqual([
      'global.cancel',
      'global.download',
      'global.ok',
    ])

    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')
    await buttons[2]?.trigger('click')

    expect(cancel).toHaveBeenCalledOnce()
    expect(download).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('omits OK for a read-only JSON viewer', () => {
    const { wrapper } = mountAction()

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'global.cancel',
      'global.download',
    ])
  })
})
