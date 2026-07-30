import { computed, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { EntityItem, SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import ApiScriptService from '@/services/api.script.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { buildTableOrderBy } from '@/utils/saplingTableUtil'
import {
  buildScriptButtonExecutionKey,
  handleScriptResultClient,
  pushScriptButtonAlreadyRunningMessage,
  pushScriptButtonStartedMessage,
} from '@/utils/saplingScriptResultUtil'

interface SaplingTableScriptProps {
  entityHandle: string
  entity: EntityItem | null
  scriptButtons?: ScriptButtonItem[]
}

interface UseSaplingTableScriptsOptions {
  props: SaplingTableScriptProps
  selectedItems: Ref<SaplingGenericItem[]>
  reload: () => void
}

/** Loads and executes reusable single-row and multi-select table scripts. */
export function useSaplingTableScripts({
  props,
  selectedItems,
  reload,
}: UseSaplingTableScriptsOptions) {
  const { t, te } = useI18n()
  const router = useRouter()
  const currentPersonStore = useCurrentPersonStore()
  const { pushMessage } = useSaplingMessageCenter()
  const loadedScriptButtons = ref<ScriptButtonItem[]>([])
  const runningScriptButtonKeys = new Set<string>()
  let scriptButtonsRequestId = 0

  const scriptButtons = computed(() => props.scriptButtons ?? loadedScriptButtons.value)
  const multiSelectScriptButtons = computed(() =>
    scriptButtons.value.filter((button) => button.isMultiSelect),
  )
  const rowScriptButtons = computed(() =>
    scriptButtons.value.filter((button) => !button.isMultiSelect),
  )

  watch(
    () => [props.entityHandle, props.scriptButtons] as const,
    () => {
      void loadScriptButtons()
    },
    { immediate: true },
  )

  async function loadScriptButtons() {
    if (props.scriptButtons) {
      loadedScriptButtons.value = props.scriptButtons
      return
    }

    if (!props.entityHandle) {
      loadedScriptButtons.value = []
      return
    }

    const currentRequestId = ++scriptButtonsRequestId
    const result = await ApiGenericService.findAll<ScriptButtonItem>('scriptButton', {
      filter: { entity: { handle: props.entityHandle } },
      orderBy: buildTableOrderBy([{ key: 'title', order: 'asc' }]),
      relations: ['m:1'],
    })

    if (currentRequestId === scriptButtonsRequestId) {
      loadedScriptButtons.value = result
    }
  }

  async function executeScriptButton(button: ScriptButtonItem, items: SaplingGenericItem[]) {
    if (!props.entity || items.length === 0) {
      return
    }

    const executionKey = buildScriptButtonExecutionKey(button, items)
    if (runningScriptButtonKeys.has(executionKey)) {
      pushScriptButtonAlreadyRunningMessage({
        button,
        entity: props.entityHandle,
        pushMessage,
        translate: t,
        hasTranslation: te,
      })
      return
    }

    runningScriptButtonKeys.add(executionKey)
    pushScriptButtonStartedMessage({
      button,
      entity: props.entityHandle,
      itemCount: items.length,
      pushMessage,
      translate: t,
      hasTranslation: te,
    })

    try {
      await currentPersonStore.fetchCurrentPerson()
      if (!currentPersonStore.person) {
        return
      }

      const result = await ApiScriptService.runClient(
        items,
        props.entity,
        currentPersonStore.person,
        button.name,
        button.parameter,
      )

      await handleScriptResultClient(result, {
        entity: props.entityHandle,
        pushMessage,
        router,
      })

      if (result.isSuccess !== false) {
        reload()
      }
    } catch {
      // API errors are already routed through the shared message center.
    } finally {
      runningScriptButtonKeys.delete(executionKey)
    }
  }

  async function runSelectionScriptButton(button: ScriptButtonItem) {
    await executeScriptButton(button, selectedItems.value)
  }

  async function runRowScriptButton(payload: {
    button: ScriptButtonItem
    item: SaplingGenericItem
  }) {
    await executeScriptButton(payload.button, [payload.item])
  }

  return {
    scriptButtons,
    multiSelectScriptButtons,
    rowScriptButtons,
    runSelectionScriptButton,
    runRowScriptButton,
  }
}
