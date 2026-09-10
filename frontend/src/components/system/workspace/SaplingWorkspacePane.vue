<template>
  <div
    :id="`workspace-panel-${tab.id}`"
    class="sapling-workspace-pane"
    role="tabpanel"
    :aria-labelledby="`workspace-tab-${tab.id}`"
  >
    <RouterView :route="tab.route" v-slot="{ Component }">
      <Suspense>
        <component :is="Component" />
        <template #fallback>
          <div class="sapling-page-shell sapling-page-shell--fill sapling-route-loading">
            <v-skeleton-loader
              class="sapling-route-loading__surface"
              type="article, actions, table"
            />
          </div>
        </template>
      </Suspense>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import {
  RouterView,
  routeLocationKey,
  routerKey,
  useRouter,
  type RouteLocationRaw,
  type RouteLocationNormalizedLoaded,
  type Router,
} from 'vue-router'
import { workspaceTabKey } from '@/composables/system/workspaceTabContext'
import {
  WORKSPACE_TAB_QUERY,
  workspaceRoute,
  type WorkspaceTab,
} from '@/composables/system/useWorkspaceTabs'

const props = defineProps<{ tab: WorkspaceTab; active: boolean }>()
const emit = defineEmits<{ routeChange: [route: RouteLocationNormalizedLoaded] }>()
const router = useRouter()
const route = new Proxy(props.tab.route, {
  get: (_target, key) => Reflect.get(props.tab.route, key),
})
provide(routeLocationKey, route)

function resolve(target: RouteLocationRaw) {
  return router.resolve(target, props.tab.route)
}

async function replace(target: RouteLocationRaw) {
  const resolved = resolve(target)
  if (resolved.path !== props.tab.route.path) return props.active ? router.push(target) : undefined
  const destination = {
    path: resolved.path,
    query: { ...resolved.query, [WORKSPACE_TAB_QUERY]: props.tab.id },
    hash: resolved.hash,
  }
  if (props.active) return router.replace(destination)
  emit('routeChange', workspaceRoute(router.resolve(destination)))
}

const scopedRouter = new Proxy(router, {
  get(target, key) {
    if (key === 'currentRoute') return computed(() => props.tab.route)
    if (key === 'replace') return replace
    if (key === 'resolve') return resolve
    if (key === 'push')
      return (destination: RouteLocationRaw) => {
        if (!props.active) return Promise.resolve()
        const resolved = resolve(destination)
        return router.push(
          resolved.path === props.tab.route.path
            ? {
                path: resolved.path,
                query: { ...resolved.query, [WORKSPACE_TAB_QUERY]: props.tab.id },
                hash: resolved.hash,
              }
            : { ...resolved, query: { ...resolved.query, [WORKSPACE_TAB_QUERY]: undefined } },
        )
      }
    return Reflect.get(target, key)
  },
}) as Router
provide(routerKey, scopedRouter)
provide(workspaceTabKey, {
  id: props.tab.id,
  state: new Map(),
  get active() {
    return props.active
  },
  get route() {
    return props.tab.route
  },
  get fullPath() {
    return props.tab.route.fullPath
  },
  replaceUrl: (path) => {
    void replace(path)
  },
  setDirty: (key, dirty) => {
    if (dirty) props.tab.dirty.add(key)
    else props.tab.dirty.delete(key)
  },
  setRecordLabel: (key, record) => {
    if (record) props.tab.recordLabels.set(key, record)
    else props.tab.recordLabels.delete(key)
  },
  setPageLabel: (key, label) => {
    if (label) props.tab.pageLabels.set(key, label)
    else props.tab.pageLabels.delete(key)
  },
  setDraftCleanup: (key, cleanup) => {
    if (cleanup) props.tab.draftCleanups.set(key, cleanup)
    else props.tab.draftCleanups.delete(key)
  },
})
</script>
