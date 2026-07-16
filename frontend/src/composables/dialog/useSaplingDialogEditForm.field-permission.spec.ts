import { computed, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import { useSaplingDialogEditForm } from './useSaplingDialogEditForm'

describe('useSaplingDialogEditForm field permissions', () => {
  it('keeps write-only values empty and omits them until changed', async () => {
    const form = ref<Record<string, unknown>>({})
    const initialFormSnapshot = ref<Record<string, string>>({})
    const templates = computed(
      () =>
        [
          {
            name: 'title',
            type: 'string',
            options: [],
            fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
          },
          {
            name: 'secret',
            type: 'string',
            options: [],
            fieldAccess: { allowRead: false, allowInsert: true, allowUpdate: true },
          },
        ] as unknown as EntityTemplate[],
    )
    const helper = useSaplingDialogEditForm({
      form,
      templates,
      mode: computed(() => 'edit'),
      item: computed(() => ({ title: 'Visible', secret: 'must-not-prefill' })),
      parent: computed(() => null),
      parentEntity: computed(() => null),
      relationTemplates: computed(() => []),
      currentPerson: computed(() => null),
      isHydratingForm: ref(false),
      isLoading: ref(false),
      initialFormSnapshot,
      hasFormValue: (value) => value != null && value !== '',
      syncInitialFormSnapshot: () => {
        initialFormSnapshot.value = JSON.parse(JSON.stringify(form.value)) as Record<string, string>
      },
      formatLocalDate: () => '',
      formatLocalTime: () => '',
      getLocalDateTimeParts: () => ({ date: '', time: '' }),
      toUtcIsoString: () => null,
    })

    helper.initializeForm()
    await nextTick()
    expect(form.value.secret).toBe('')
    expect(helper.buildSavePayload()).toEqual({ title: 'Visible' })

    form.value.secret = 'replacement'
    expect(helper.buildSavePayload()).toEqual({
      title: 'Visible',
      secret: 'replacement',
    })
  })
})
