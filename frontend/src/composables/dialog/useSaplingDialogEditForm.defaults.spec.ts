import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { useSaplingDialogEditForm } from './useSaplingDialogEditForm'

describe('useSaplingDialogEditForm create defaults', () => {
  it('fills missing reference defaults and current references in a seeded create draft', async () => {
    const form = ref<SaplingGenericItem>({})
    const initialFormSnapshot = ref<Record<string, string>>({})
    const currentPerson = { handle: 5, firstName: 'Max', lastName: 'Mustermann' }
    const onHydrated = vi.fn()
    const templates = computed(
      () =>
        [
          {
            name: 'type',
            type: 'EventTypeItem',
            kind: 'm:1',
            isReference: true,
            referencedPks: ['handle'],
            formConfig: {
              defaultValue: {
                handle: 'online',
                title: 'Online',
              },
            },
          },
          {
            name: 'status',
            type: 'EventStatusItem',
            kind: 'm:1',
            isReference: true,
            referencedPks: ['handle'],
            default: 'scheduled',
          },
          {
            name: 'creatorPerson',
            type: 'PersonItem',
            kind: 'm:1',
            isReference: true,
            referencedPks: ['handle'],
            options: ['isCurrentPerson'],
          },
          {
            name: 'participants',
            type: 'Collection<PersonItem>',
            kind: 'm:n',
            isReference: true,
            referencedPks: ['handle'],
          },
        ] as EntityTemplate[],
    )
    const helper = useSaplingDialogEditForm({
      form,
      templates,
      mode: computed(() => 'create'),
      item: computed(() => ({
        title: 'Neuer Termin',
        participants: [5, 7],
      })),
      parent: computed(() => null),
      parentEntity: computed(() => null),
      relationTemplates: computed(() => []),
      currentPerson: computed(() => currentPerson),
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
      onHydrated,
    })

    helper.initializeForm()
    await nextTick()

    expect(form.value.type).toEqual({
      handle: 'online',
      title: 'Online',
    })
    expect(form.value.status).toEqual({ handle: 'scheduled' })
    expect(form.value.creatorPerson).toEqual(currentPerson)
    expect(form.value.participants).toEqual([{ handle: 5 }, { handle: 7 }])
    expect(helper.buildSavePayload()).toEqual({
      type: 'online',
      status: 'scheduled',
      creatorPerson: 5,
      participants: [5, 7],
    })
    expect(initialFormSnapshot.value).toEqual(form.value)
    expect(onHydrated).toHaveBeenCalledTimes(1)
  })

  it('serializes a date-only field without converting local midnight to UTC', () => {
    const selectedDate = new Date(2026, 5, 20)
    const form = ref<SaplingGenericItem>({ expectedCompletionDate: selectedDate })
    const templates = computed(
      () =>
        [
          {
            name: 'expectedCompletionDate',
            type: 'DateType',
          },
        ] as EntityTemplate[],
    )
    const helper = useSaplingDialogEditForm({
      form,
      templates,
      mode: computed(() => 'edit'),
      item: computed(() => null),
      parent: computed(() => null),
      parentEntity: computed(() => null),
      relationTemplates: computed(() => []),
      currentPerson: computed(() => null),
      isHydratingForm: ref(false),
      isLoading: ref(false),
      initialFormSnapshot: ref<Record<string, string>>({}),
      hasFormValue: (value) => value != null && value !== '',
      syncInitialFormSnapshot: () => undefined,
      formatLocalDate: (date) =>
        `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`,
      formatLocalTime: () => '',
      getLocalDateTimeParts: () => ({ date: '', time: '' }),
      toUtcIsoString: () => null,
    })

    expect(helper.buildSavePayload()).toEqual({
      expectedCompletionDate: '2026-06-20',
    })
  })
})
