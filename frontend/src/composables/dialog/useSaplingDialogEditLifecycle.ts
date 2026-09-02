import { onBeforeUnmount, type Ref } from 'vue'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'

interface DialogInitializationOptions {
  isLoading: Ref<boolean>
  load: () => Promise<void>
  afterLoad: () => void
  onError?: (error: unknown) => void
}

export async function initializeSaplingDialogEdit(
  options: DialogInitializationOptions,
): Promise<void> {
  options.isLoading.value = true
  try {
    await options.load()
  } catch (error) {
    options.onError?.(error)
  } finally {
    options.isLoading.value = false
    options.afterLoad()
  }
}

export function useSaplingDialogBeforeUnloadGuard(shouldWarn: () => boolean): void {
  if (typeof window === 'undefined') return
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!shouldWarn()) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
}

export async function loadSaplingDialogPermissions(
  permissions: Ref<AccumulatedPermission[] | null>,
): Promise<void> {
  const store = useCurrentPermissionStore()
  await store.fetchCurrentPermission()
  permissions.value = store.accumulatedPermission
}

export async function loadActiveDialogRelation(
  relationTemplates: EntityTemplate[],
  activeTab: number,
  ensureItems: (name: string) => Promise<void>,
): Promise<void> {
  const template = relationTemplates[activeTab - 1]
  if (template) await ensureItems(template.name)
}

export function initializeDialogFormWithParentContext(
  initializeForm: () => void,
  syncParentReferences: () => void,
): void {
  initializeForm()
  syncParentReferences()
}
