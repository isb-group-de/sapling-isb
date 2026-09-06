import { ref, onMounted, watch } from 'vue'
import TranslationService from '@/services/translation.service'
import { i18n } from '@/i18n'

type UseTranslationLoaderOptions = {
  autoLoad?: boolean
}

export function useTranslationLoader(...args: Array<string | UseTranslationLoaderOptions>) {
  const lastArgument = args[args.length - 1]
  const options =
    typeof lastArgument === 'object' && lastArgument !== null && !Array.isArray(lastArgument)
      ? lastArgument
      : undefined
  const namespaces = (options ? args.slice(0, -1) : args) as string[]

  const translationService = ref(new TranslationService())
  const autoLoad = options?.autoLoad ?? true
  const isLoading = ref(autoLoad)

  function triggerLoadTranslations() {
    void loadTranslations().catch(() => undefined)
  }

  async function loadTranslations() {
    isLoading.value = true
    try {
      await translationService.value.prepare(...namespaces)
    } finally {
      isLoading.value = false
    }
  }

  // Nur beim Mounten laden, Watcher nur auslösen wenn sich die Sprache wirklich ändert
  let lastLocale = i18n.global.locale.value
  onMounted(() => {
    if (autoLoad) {
      triggerLoadTranslations()
    }
  })
  watch(
    () => i18n.global.locale.value,
    (newLocale) => {
      if (newLocale !== lastLocale && autoLoad) {
        lastLocale = newLocale
        triggerLoadTranslations()
      }
    },
  )

  return { translationService, isLoading, loadTranslations }
}
