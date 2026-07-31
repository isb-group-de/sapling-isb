import { watch, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { EditDialogOptions } from '@/entity/structure'
import { clearRouteQueryParameter, setRouteQueryParameter } from '@/utils/routerNavigation'

interface SaplingTableRouteDialogSyncOptions {
  enabled: () => boolean
  editDialog: Ref<EditDialogOptions>
  router: Router
  getRoute: () => Pick<RouteLocationNormalizedLoaded, 'hash' | 'query'>
}

/**
 * Keeps the primary table workspace's edit dialog shareable through `?open=`.
 * Embedded tables intentionally opt out so their local dialogs cannot replace
 * the parent workspace record encoded by the same route parameter.
 */
export function useSaplingTableRouteDialogSync({
  enabled,
  editDialog,
  router,
  getRoute,
}: SaplingTableRouteDialogSyncOptions): void {
  let routeEditDialogHandle: string | null = null

  watch(
    () => [editDialog.value.visible, editDialog.value.item?.handle] as const,
    ([isVisible, handle], [wasVisible]) => {
      if (!enabled()) {
        return
      }

      if (isVisible && (typeof handle === 'string' || typeof handle === 'number')) {
        routeEditDialogHandle = String(handle)
        void setRouteQueryParameter(router, getRoute(), 'open', handle)
        return
      }

      if (wasVisible && !isVisible && routeEditDialogHandle !== null) {
        routeEditDialogHandle = null
        void clearRouteQueryParameter(router, getRoute(), 'open')
      }
    },
  )
}
