import { computed, defineComponent, reactive, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingIssue from '../SaplingIssue.vue'

const SaplingTextFieldStub = defineComponent({
  name: 'SaplingTextField',
  props: {
    modelValue: { type: String, default: '' },
    hideDetails: { type: [Boolean, String], default: undefined },
    persistentCounter: Boolean,
  },
  template: '<input class="sapling-text-field-stub" />',
})

const VBtnToggleStub = defineComponent({
  name: 'VBtnToggle',
  template: '<div><slot /></div>',
})

vi.mock('@/composables/system/useSaplingIssue', () => ({
  useSaplingIssue: () => {
    const draft = reactive({
      title: '',
      description: '',
      type: 'bug' as 'bug' | 'feature',
    })

    return {
      draft,
      openIssues: ref([]),
      closedIssues: ref([]),
      latestCreatedIssue: ref(null),
      directIssueUrl: computed(() => ''),
      isCreateDisabled: computed(() => true),
      isCreateLoading: ref(false),
      isTranslationLoading: ref(false),
      isLoading: ref(true),
      createIssue: vi.fn(),
      resetDraft: vi.fn(),
    }
  },
}))

describe('SaplingIssue', () => {
  it('keeps the title details reserved and groups the issue type beside it', () => {
    const wrapper = shallowMount(SaplingIssue, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          VContainer: { template: '<main><slot /></main>' },
          SaplingTextField: SaplingTextFieldStub,
          SaplingPageHero: { template: '<div><slot /><slot name="side" /></div>' },
          SaplingSurface: { template: '<section><slot /></section>' },
          SaplingMarkdownField: true,
          SaplingIssuesOpen: true,
          SaplingIssuesClosed: true,
          VForm: { template: '<form><slot /></form>' },
          VBtnToggle: VBtnToggleStub,
          VBtn: { template: '<button><slot /></button>' },
          VIcon: true,
          VSpacer: true,
          VRow: true,
        },
      },
    })

    const titleField = wrapper.getComponent(SaplingTextFieldStub)
    const primaryRow = wrapper.get('.sapling-issue-compose__primary-row')

    expect(wrapper.find('.sapling-issue-hero__pulse-skeleton').exists()).toBe(true)
    expect(titleField.props('hideDetails')).toBe(false)
    expect(titleField.props('persistentCounter')).toBe(true)
    expect(primaryRow.findComponent(SaplingTextFieldStub).exists()).toBe(true)
    const typeField = primaryRow.get('.sapling-issue-compose__type-field')

    expect(typeField.find('.sapling-label').exists()).toBe(false)
    expect(typeField.findComponent(VBtnToggleStub).attributes('aria-label')).toBe(
      'issue.typeFieldLabel',
    )
  })
})
