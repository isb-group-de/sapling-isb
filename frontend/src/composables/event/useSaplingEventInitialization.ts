import type { Ref } from 'vue'
import ApiGenericService from '@/services/api.generic.service'
import ApiTemplateService from '@/services/api.template.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import type {
  EntityItem,
  EventCategoryItem,
  EventStatusItem,
  EventTypeItem,
  PersonItem,
} from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import {
  DEFAULT_EVENT_CATEGORY_HANDLE,
  DEFAULT_EVENT_STATUS_HANDLE,
  DEFAULT_EVENT_TYPE_HANDLE,
} from './eventCalendar.utils'

export function useSaplingEventInitialization(options: {
  currentPersonStore: ReturnType<typeof useCurrentPersonStore>
  ownPerson: Ref<PersonItem | null>
  peopleMap: Ref<Record<number, PersonItem>>
  selectedPeople: Ref<number[]>
  templates: Ref<EntityTemplate[]>
  defaultEventType: Ref<EventTypeItem | null>
  defaultEventStatus: Ref<EventStatusItem | null>
  defaultEventCategory: Ref<EventCategoryItem | null>
  entityEvent: Ref<EntityItem | null>
}) {
  async function loadOwnPerson() {
    await options.currentPersonStore.fetchCurrentPerson()
    options.ownPerson.value = options.currentPersonStore.person
    if (typeof options.ownPerson.value?.handle === 'number') {
      options.peopleMap.value[options.ownPerson.value.handle] = options.ownPerson.value
    }
    options.selectedPeople.value =
      options.ownPerson.value?.handle != null ? [options.ownPerson.value.handle] : []
  }

  async function loadTemplates() {
    options.templates.value = await ApiTemplateService.getEntityTemplate('event')
  }

  async function loadEventDefaults() {
    const [typeResponse, statusResponse, categoryResponse] = await Promise.all([
      ApiGenericService.find<EventTypeItem>('eventType', {
        filter: { handle: DEFAULT_EVENT_TYPE_HANDLE },
        limit: 1,
        page: 1,
      }),
      ApiGenericService.find<EventStatusItem>('eventStatus', {
        filter: { handle: DEFAULT_EVENT_STATUS_HANDLE },
        limit: 1,
        page: 1,
      }),
      ApiGenericService.find<EventCategoryItem>('eventCategory', {
        filter: { handle: DEFAULT_EVENT_CATEGORY_HANDLE },
        limit: 1,
        page: 1,
      }),
    ])
    options.defaultEventType.value = typeResponse.data[0] ?? null
    options.defaultEventStatus.value = statusResponse.data[0] ?? null
    options.defaultEventCategory.value = categoryResponse.data[0] ?? null
  }

  async function loadEventEntity() {
    options.entityEvent.value =
      (
        await ApiGenericService.find<EntityItem>('entity', {
          filter: { handle: 'event' },
          limit: 1,
          page: 1,
        })
      ).data[0] || null
  }

  return { loadOwnPerson, loadTemplates, loadEventDefaults, loadEventEntity }
}
