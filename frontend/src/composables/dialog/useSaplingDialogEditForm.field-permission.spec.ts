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

  it('omits explicitly non-writable identity and technical fields from edit payloads', async () => {
    const form = ref<Record<string, unknown>>({})
    const initialFormSnapshot = ref<Record<string, string>>({})
    const templates = computed(
      () =>
        [
          {
            name: 'handle',
            type: 'number',
            options: [],
            isAutoIncrement: true,
            fieldAccess: { allowRead: true, allowInsert: false, allowUpdate: false },
          },
          {
            name: 'name',
            type: 'string',
            options: [],
            fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
          },
          {
            name: 'createdAt',
            type: 'datetime',
            options: ['isReadOnly'],
            fieldAccess: { allowRead: true, allowInsert: false, allowUpdate: false },
          },
        ] as unknown as EntityTemplate[],
    )
    const helper = useSaplingDialogEditForm({
      form,
      templates,
      mode: computed(() => 'edit'),
      item: computed(() => ({
        handle: 4,
        name: 'Bauer IT Solutions',
        createdAt: '2026-07-16T15:20:00.000Z',
      })),
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
      getLocalDateTimeParts: (value) => ({
        date: typeof value === 'string' ? '2026-07-16' : '',
        time: typeof value === 'string' ? '15:20' : '',
      }),
      toUtcIsoString: () => '2026-07-16T15:20:00.000Z',
    })

    helper.initializeForm()
    await nextTick()
    form.value.name = 'Bauer IT Solutions 1'

    expect(helper.buildSavePayload()).toEqual({ name: 'Bauer IT Solutions 1' })
  })

  it('omits manual primary keys from edit payloads even when update access is allowed', async () => {
    const form = ref<Record<string, unknown>>({})
    const initialFormSnapshot = ref<Record<string, string>>({})
    const templates = computed(
      () =>
        [
          {
            name: 'handle',
            type: 'string',
            options: [],
            isAutoIncrement: false,
            fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
          },
          {
            name: 'title',
            type: 'string',
            options: [],
            fieldAccess: { allowRead: true, allowInsert: true, allowUpdate: true },
          },
        ] as unknown as EntityTemplate[],
    )
    const helper = useSaplingDialogEditForm({
      form,
      templates,
      mode: computed(() => 'edit'),
      item: computed(() => ({ handle: 'technical-id', title: 'Before' })),
      parent: computed(() => null),
      parentEntity: computed(() => null),
      relationTemplates: computed(() => []),
      currentPerson: computed(() => null),
      isHydratingForm: ref(false),
      isLoading: ref(false),
      initialFormSnapshot,
      hasFormValue: (value) => value != null && value !== '',
      syncInitialFormSnapshot: () => undefined,
      formatLocalDate: () => '',
      formatLocalTime: () => '',
      getLocalDateTimeParts: () => ({ date: '', time: '' }),
      toUtcIsoString: () => null,
    })

    helper.initializeForm()
    await nextTick()
    form.value.handle = 'attempted-change'
    form.value.title = 'After'

    expect(helper.buildSavePayload()).toEqual({ title: 'After' })
  })
})
