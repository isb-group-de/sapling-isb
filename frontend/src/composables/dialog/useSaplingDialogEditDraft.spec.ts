import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import { readSaplingDialogDraft } from './saplingDialogDraftStorage'
import { useSaplingDialogEditDraft } from './useSaplingDialogEditDraft'

describe('useSaplingDialogEditDraft', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/table/ticket')
  })

  it('persists dirty form values and restores them into the same record as dirty changes', async () => {
    const templates = computed(
      () =>
        [
          { name: 'title', type: 'string' },
          { name: 'scheduledAt', type: 'datetime' },
        ] as EntityTemplate[],
    )
    const originalTitle = 'Persisted title'
    const form = ref({
      title: originalTitle,
      scheduledAt_date: '2026-09-02',
      scheduledAt_time: '08:00',
    })
    const isHydratingForm = ref(false)
    const isDirty = computed(() => form.value.title !== originalTitle)
    const commonOptions = {
      templates,
      mode: computed(() => 'edit' as const),
      entity: computed(() => ({ handle: 'ticket' }) as never),
      item: computed(() => ({ handle: 42, updatedAt: '2026-09-02T08:00:00.000Z' })),
      parent: computed(() => null),
      parentEntity: computed(() => null),
      person: computed(() => ({ handle: 7 })),
      modelValue: computed(() => true),
      isHydratingForm,
    }
    const firstDialog = useSaplingDialogEditDraft({ form, isDirty, ...commonOptions })

    firstDialog.restoreDraft()
    form.value.title = 'Recovered title'
    form.value.scheduledAt_time = '09:30'
    await nextTick()

    const restoredForm = ref({
      title: originalTitle,
      scheduledAt_date: '2026-09-02',
      scheduledAt_time: '08:00',
    })
    const restoredDirty = computed(() => restoredForm.value.title !== originalTitle)
    const reopenedDialog = useSaplingDialogEditDraft({
      form: restoredForm,
      isDirty: restoredDirty,
      ...commonOptions,
    })

    reopenedDialog.restoreDraft()

    expect(restoredForm.value).toEqual({
      title: 'Recovered title',
      scheduledAt_date: '2026-09-02',
      scheduledAt_time: '09:30',
    })
    expect(restoredDirty.value).toBe(true)
  })

  it('does not restore a draft into another record and removes it after reset', async () => {
    const templates = computed(() => [{ name: 'title', type: 'string' }] as EntityTemplate[])
    const form = ref({ title: 'Original' })
    const isDirty = computed(() => form.value.title !== 'Original')
    const item = ref({ handle: 42, updatedAt: 'v1' })
    const draft = useSaplingDialogEditDraft({
      form,
      templates,
      mode: computed(() => 'edit'),
      entity: computed(() => ({ handle: 'ticket' }) as never),
      item: computed(() => item.value),
      parent: computed(() => null),
      parentEntity: computed(() => null),
      person: computed(() => ({ handle: 7 })),
      modelValue: computed(() => true),
      isDirty,
      isHydratingForm: ref(false),
    })

    draft.restoreDraft()
    form.value.title = 'Draft'
    await nextTick()

    item.value = { handle: 43, updatedAt: 'v1' }
    form.value.title = 'Other record'
    draft.restoreDraft()
    expect(form.value.title).toBe('Other record')

    item.value = { handle: 42, updatedAt: 'v1' }
    draft.restoreDraft()
    expect(form.value.title).toBe('Draft')

    draft.clearDraft()
    expect(
      readSaplingDialogDraft('edit', {
        route: '/table/ticket',
        personHandle: '7',
        entityHandle: 'ticket',
        mode: 'edit',
        recordHandle: '42',
        recordVersion: 'v1',
        parentEntityHandle: '',
        parentRecordHandle: '',
        detailHandle: '',
        detailVersion: '',
      }),
    ).toBeNull()
  })
})
