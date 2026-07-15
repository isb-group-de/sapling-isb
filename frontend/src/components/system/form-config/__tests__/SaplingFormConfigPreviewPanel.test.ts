import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import SaplingFormConfigPreviewPanel from '../SaplingFormConfigPreviewPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'company.name': 'Name',
        'formConfig.livePreview': 'Live preview',
        'formConfig.preview': 'Preview',
        'formConfig.previewForm': 'Form',
        'formConfig.previewTable': 'Table',
        'formConfig.previewMobileTable': 'Mobile table',
        'formConfig.required': 'Required',
        'formConfig.optional': 'Optional',
        'navigation.company': 'Companies',
      })[key] ?? key,
    te: (key: string) => ['company.name', 'navigation.company'].includes(key),
  }),
}))

const templates = [
  {
    key: 'name',
    name: 'name',
    type: 'string',
    formGroup: 'company.groupBasics',
    formGroupOrder: 100,
    formOrder: 100,
    formWidth: 2,
    formVisible: true,
    tableVisible: true,
    tableOrder: 100,
    mobileVisible: true,
    mobileOrder: 100,
    isRequired: true,
  },
] satisfies EntityTemplate[]

function mountPreview(previewMode: 'form' | 'table' | 'mobile') {
  return mount(SaplingFormConfigPreviewPanel, {
    props: {
      selectedEntityHandle: 'company',
      draftTemplates: templates,
      previewMode,
      reloadDisabled: false,
    },
    global: {
      stubs: {
        SaplingSurface: {
          props: ['as'],
          template: '<component :is="as || \'div\'"><slot /></component>',
        },
        VBtn: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        VChip: { template: '<span><slot /></span>' },
        VIcon: { template: '<i />' },
      },
    },
  })
}

describe('SaplingFormConfigPreviewPanel', () => {
  it('keeps all preview tabs rendered and emits explicit mode changes', async () => {
    const wrapper = mountPreview('form')
    const tabs = wrapper.findAll('[role="tab"]')

    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.text())).toEqual(['Form', 'Table', 'Mobile table'])

    await tabs[1]?.trigger('click')
    expect(wrapper.emitted('update:previewMode')).toEqual([['table']])
  })

  it('renders group structure and field names with friendly types', () => {
    const wrapper = mountPreview('form')

    expect(wrapper.text()).toContain('Basics')
    expect(wrapper.text()).toContain('company.groupBasics')
    expect(wrapper.text()).toContain('Name (Short Text)')
    expect(wrapper.text()).toContain('name · Required')
  })

  it('shows field structure without sample values in table and mobile modes', () => {
    const table = mountPreview('table')
    const mobile = mountPreview('mobile')

    expect(table.text()).toContain('Name')
    expect(table.text()).toContain('Short Text')
    expect(table.find('tbody').exists()).toBe(false)
    expect(mobile.text()).toContain('Name')
    expect(mobile.text()).toContain('Short Text')
    expect(`${table.text()} ${mobile.text()}`).not.toContain('true')
  })
})
