import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { ColumnFilterItem, EntityTemplate, SortItem } from '@/entity/structure'
import type { EntityItem, FavoriteItem } from '@/entity/entity'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { buildFavoritePath } from '@/utils/saplingFavoriteNavigation'
import { buildTableFilter, buildTableOrderBy } from '@/utils/saplingTableUtil'

interface FavoriteDialogState {
  visible: boolean
  title: string
}

interface SaplingTableFavoritesProps {
  search: string
  sortBy: SortItem[]
  entityHandle: string
  entity: EntityItem | null
  entityTemplates: EntityTemplate[]
  parentFilter?: Record<string, unknown>
}

interface UseSaplingTableFavoritesOptions {
  props: SaplingTableFavoritesProps
  localColumnFilters: Ref<Record<string, ColumnFilterItem>>
}

/** Manages table-specific favorite persistence, matching, and navigation. */
export function useSaplingTableFavorites({
  props,
  localColumnFilters,
}: UseSaplingTableFavoritesOptions) {
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const currentPersonStore = useCurrentPersonStore()
  const { pushMessage } = useSaplingMessageCenter()

  const favoriteDialog = ref<FavoriteDialogState>({ visible: false, title: '' })
  const currentEntityFavorites = ref<FavoriteItem[]>([])
  const isCurrentEntityFavoritesLoading = ref(false)
  let favoritesRequestId = 0

  watch(
    () => props.entityHandle,
    () => {
      void loadCurrentEntityFavorites()
    },
    { immediate: true },
  )

  async function loadCurrentEntityFavorites() {
    if (!props.entityHandle) {
      currentEntityFavorites.value = []
      isCurrentEntityFavoritesLoading.value = false
      return
    }

    const currentRequestId = ++favoritesRequestId
    isCurrentEntityFavoritesLoading.value = true

    try {
      await currentPersonStore.fetchCurrentPerson()
      const personHandle = currentPersonStore.person?.handle

      if (personHandle == null) {
        currentEntityFavorites.value = []
        return
      }

      const result = await ApiGenericService.findAll<FavoriteItem>('favorite', {
        filter: {
          person: { handle: personHandle },
          entity: { handle: props.entityHandle },
        },
        orderBy: buildTableOrderBy([{ key: 'title', order: 'asc' }]),
        relations: ['entity', 'entityRoute'],
      })

      if (currentRequestId === favoritesRequestId) {
        currentEntityFavorites.value = result
      }
    } finally {
      if (currentRequestId === favoritesRequestId) {
        isCurrentEntityFavoritesLoading.value = false
      }
    }
  }

  function openFavoriteDialog() {
    const trimmedSearch = props.search.trim()
    const entityTitle = getFavoriteEntityTitle()
    favoriteDialog.value = {
      visible: true,
      title: trimmedSearch.length > 0 ? `${entityTitle}: ${trimmedSearch}` : entityTitle,
    }
  }

  function closeFavoriteDialog() {
    favoriteDialog.value = { visible: false, title: '' }
  }

  async function saveFavorite() {
    const trimmedTitle = favoriteDialog.value.title.trim()
    if (trimmedTitle.length === 0 || !props.entityHandle) {
      return
    }

    await currentPersonStore.fetchCurrentPerson()
    const personHandle = currentPersonStore.person?.handle
    if (personHandle == null) {
      return
    }

    try {
      await ApiGenericService.create<FavoriteItem>('favorite', {
        title: trimmedTitle,
        entity: props.entityHandle,
        entityRoute: getCurrentFavoriteEntityRouteHandle(),
        person: personHandle,
        search: getCurrentFavoriteSearch(),
        sortBy: getCurrentFavoriteSortBy(),
        filter: getCurrentFavoriteFilter(),
      })

      closeFavoriteDialog()
      await loadCurrentEntityFavorites()
      pushMessage(
        'success',
        t('global.favoriteSaved'),
        t('global.favoriteSavedDescription'),
        props.entityHandle,
      )
    } catch {
      // API errors are already routed through the shared message center.
    }
  }

  function getFavoriteEntityTitle() {
    const translationKey = `navigation.${props.entityHandle}`
    const translatedTitle = t(translationKey)
    return translatedTitle !== translationKey
      ? translatedTitle
      : (props.entity?.title ?? props.entityHandle)
  }

  function getCurrentFavoriteFilter() {
    const filter = buildTableFilter({
      search: '',
      columnFilters: localColumnFilters.value,
      entityTemplates: props.entityTemplates,
      parentFilter: props.parentFilter,
    })
    const serializedFilter = JSON.stringify(filter)

    return serializedFilter === '{}' || serializedFilter === 'null'
      ? undefined
      : (JSON.parse(serializedFilter) as FilterQuery)
  }

  function getCurrentFavoriteSearch() {
    const trimmedSearch = props.search.trim()
    return trimmedSearch.length > 0 ? trimmedSearch : undefined
  }

  function getCurrentFavoriteSortBy() {
    return props.sortBy.length > 0
      ? props.sortBy.map(({ key, order }) => ({ key, order }))
      : undefined
  }

  function getCurrentFavoriteEntityRouteHandle() {
    const currentRoutePath = route.path.replace(/^\/+|\/+$/g, '')
    const entityRoutes = props.entity?.routes ?? []
    const currentEntityRoute = entityRoutes.find(
      (entry) =>
        typeof entry.route === 'string' &&
        entry.route.replace(/^\/+|\/+$/g, '') === currentRoutePath,
    )
    const fallbackTableRoute = entityRoutes.find(
      (entry) => entry.route === `table/${props.entityHandle}`,
    )

    return currentEntityRoute?.handle ?? fallbackTableRoute?.handle
  }

  const activeFavoriteHandle = computed(() => {
    return (
      currentEntityFavorites.value.find(
        (favorite) => buildFavoritePath(favorite) === route.fullPath,
      )?.handle ?? null
    )
  })

  async function selectFavorite(favorite: FavoriteItem) {
    const targetPath = buildFavoritePath(favorite)
    if (targetPath) {
      await router.push(targetPath)
    }
  }

  async function deleteFavorite(favorite: FavoriteItem): Promise<void> {
    if (favorite.handle == null) return

    await ApiGenericService.delete('favorite', favorite.handle, { ignoreNotFound: true })
    await loadCurrentEntityFavorites()
    pushMessage(
      'success',
      t('global.favoriteDeleted'),
      t('global.favoriteDeletedDescription'),
      props.entityHandle,
    )
  }

  return {
    favoriteDialog,
    currentEntityFavorites,
    isCurrentEntityFavoritesLoading,
    activeFavoriteHandle,
    loadCurrentEntityFavorites,
    openFavoriteDialog,
    closeFavoriteDialog,
    saveFavorite,
    selectFavorite,
    deleteFavorite,
  }
}
