import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingAutomationGraph from '../SaplingAutomationGraph.vue'
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
describe('Automation graph interaction', () => {
  it('keeps keyboard highlighting when the pointer leaves a focused node', async () => {
    const wrapper = mount(SaplingAutomationGraph, {
      props: {
        graph: {
          nodes: [
            { id: 'source', type: 'event', entity: 'document', operation: 'afterCreate' },
            { id: 'target', type: 'event', entity: 'ticket', operation: 'afterUpdate' },
          ],
          edges: [{ source: 'source', target: 'target', kind: 'possible' }],
          continuations: [],
          truncated: false,
        },
      },
    })
    const node = wrapper.find('[role="button"]')
    const highlighted = () => wrapper.find('.sapling-automation-graph__edge--highlighted').exists()
    await node.trigger('focus')
    await node.trigger('mouseenter')
    await node.trigger('mouseleave')
    expect(highlighted()).toBe(true)
    await node.trigger('blur')
    expect(highlighted()).toBe(false)
  })

  it('offers the same details action by pointer and keyboard and exposes cycles', async () => {
    const graph = {
      nodes: [
        {
          id: 'event:ticket',
          type: 'event',
          entity: 'ticket',
          operation: 'afterUpdate',
          cycle: true,
        },
      ],
      edges: [],
      continuations: [],
      truncated: false,
    }
    const wrapper = mount(SaplingAutomationGraph, { props: { graph } })
    const node = wrapper.find('[role="button"]')
    expect(node.attributes('tabindex')).toBe('0')
    await node.trigger('keydown.enter')
    await node.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(2)
    expect(wrapper.find('.sapling-automation-graph__node--cycle').exists()).toBe(true)
  })
})
