import { computed, ref } from 'vue'

type SaplingIconFieldProps = {
  items: SaplingIconOption[]
  label: string
  modelValue: string
  disabled?: boolean
  required?: boolean
}

type SaplingIconFieldEmit = (event: 'update:modelValue', value: string) => void

export type SaplingIconOption = {
  name: string
}

export const SAPLING_ICON_PICKER_PAGE_SIZE = 72

export function useSaplingIconField(props: SaplingIconFieldProps, emit: SaplingIconFieldEmit) {
  const dialog = ref(false)
  const searchQuery = ref('')
  const page = ref(1)

  const modelValueProxy = computed({
    get: () => props.modelValue,
    set: (val: string) => emit('update:modelValue', val),
  })

  const computedLabel = computed(() => props.label + (props.required ? '*' : ''))

  const isDisabled = computed(() => !!props.disabled)

  const filteredItems = computed(() => {
    const normalizedQuery = normalizeIconSearchValue(searchQuery.value)
    if (!normalizedQuery) {
      return props.items
    }

    return props.items.filter((item) =>
      normalizeIconSearchValue(item.name).includes(normalizedQuery),
    )
  })

  const pageCount = computed(() =>
    Math.ceil(filteredItems.value.length / SAPLING_ICON_PICKER_PAGE_SIZE),
  )

  const pagedItems = computed(() => {
    const safePage = Math.min(Math.max(page.value, 1), Math.max(pageCount.value, 1))
    const start = (safePage - 1) * SAPLING_ICON_PICKER_PAGE_SIZE
    return filteredItems.value.slice(start, start + SAPLING_ICON_PICKER_PAGE_SIZE)
  })

  function updateModelValue(val: string) {
    emit('update:modelValue', val)
  }

  function openDialog() {
    if (isDisabled.value) {
      return
    }

    searchQuery.value = ''
    const selectedIndex = props.items.findIndex((item) => item.name === props.modelValue)
    page.value =
      selectedIndex >= 0 ? Math.floor(selectedIndex / SAPLING_ICON_PICKER_PAGE_SIZE) + 1 : 1
    dialog.value = true
  }

  function closeDialog() {
    dialog.value = false
  }

  function selectIcon(iconName: string) {
    updateModelValue(iconName)
    closeDialog()
  }

  function updateSearchQuery(value: string | null) {
    searchQuery.value = value ?? ''
    page.value = 1
  }

  return {
    closeDialog,
    computedLabel,
    dialog,
    filteredItems,
    isDisabled,
    modelValueProxy,
    openDialog,
    page,
    pageCount,
    pagedItems,
    searchQuery,
    selectIcon,
    updateSearchQuery,
    updateModelValue,
  }
}

function normalizeIconSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/^mdi-/, '').replace(/-/g, ' ')
}
