import { computed, defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { useSaplingDialogEditDirty } from '@/composables/dialog/useSaplingDialogEditDirty'
import SaplingDialogEditFieldRenderer from '../../SaplingDialogEditFieldRenderer.vue'
import SaplingFieldAutomationRule from '../SaplingFieldAutomationRule.vue'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/services/api.generic.service', () => ({
  default: { findAll: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/services/api.template.service', () => ({
  default: { getEntityTemplate: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/services/translation.service', () => ({
  default: class {
    async prepare() {}
  },
}))

describe('automation configuration dirty state', () => {
  it.each([
    ['fieldAutomation', 'conditions'],
    ['fieldAutomation', 'referencePath'],
    ['fieldAutomation', 'assignments'],
    ['inboxSubscription', 'conditions'],
    ['teamsSubscription', 'conditions'],
    ['webhookSubscription', 'conditions'],
  ] as const)('tracks adding and removing %s %s', async (entityHandle, kind) => {
    const template = { name: kind, type: 'JsonType', isPersistent: true } as EntityTemplate
    const form = ref<SaplingGenericItem>({
      [kind]: [],
      sourceEntity: 'ticket',
      targetEntity: 'ticket',
    })
    const dirty = useSaplingDialogEditDirty({
      form,
      templates: computed(() => [template]),
      initialFormSnapshot: ref({}),
      extractDependencyIdentifier: () => null,
      formatLocalDate: () => '',
      formatLocalTime: () => '',
      isValidDate: () => true,
    })
    dirty.syncInitialFormSnapshot()
    const host = defineComponent({
      components: { SaplingDialogEditFieldRenderer },
      setup: () => ({ form, entityHandle, template }),
      template: `<SaplingDialogEditFieldRenderer :template="template" :entity-handle="entityHandle" mode="edit" :form-values="form" :visible-templates="[template]" :permissions="[]" :icon-names="[]" :is-reference-visible="true" :rules="[]" :field-disabled="false" :reference-field-disabled="false" @update-field="(key, value) => form[key] = value" />`,
    })
    const wrapper = mount(host, {
      global: {
        stubs: {
          'v-btn': { template: '<button><slot /></button>' },
          SaplingAutocomplete: true,
          SaplingTextField: true,
          SaplingNumberField: true,
          SaplingFieldSingleSelect: true,
          SaplingFieldAutomationRule,
        },
      },
    })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('button').exists()).toBe(true))
    expect(dirty.isDirty.value).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(dirty.isDirty.value).toBe(true)
    expect(dirty.isTemplateDirty(template)).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(dirty.isDirty.value).toBe(false)
    wrapper.unmount()
  })
})
