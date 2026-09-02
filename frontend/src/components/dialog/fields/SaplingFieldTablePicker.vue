<template>
  <div
    ref="fieldRootRef"
    class="sapling-field-table-picker"
    @focusout="closeMenuWhenFocusLeaves"
    @keydown.tab.capture="closeMenuOnTab"
    @keydown.esc="closeMenuOnEscape"
  >
    <template v-if="usesFullscreenPicker">
      <div ref="activatorRef" class="sapling-field-table-picker__activator">
        <slot
          name="activator"
          :props="fullscreenActivatorProps"
          :focus-first-result="focusFirstMenuRow"
        />
      </div>

      <SaplingDialog
        :id="pickerDialogId"
        v-model="model"
        docked
        fullscreen
        @keydown.esc.stop="closePicker"
      >
        <SaplingDialogCard
          class="sapling-dialog-card--fullscreen sapling-field-table-picker__dialog"
          :close="closePicker"
        >
          <SaplingDialogShell
            fill-shell
            body-class="sapling-dialog-fill-body sapling-field-table-picker__dialog-body"
          >
            <template #hero>
              <SaplingDialogHero :eyebrow="$t('global.select')" :title="props.label" />
            </template>

            <template #body>
              <div
                ref="menuSurfaceRef"
                class="sapling-field-table-picker__fullscreen-content"
                @focusout="closeMenuWhenFocusLeaves"
                @keydown.esc="closeMenuOnEscape"
                @keydown.down.prevent="moveMenuRowFocus(1)"
                @keydown.up.prevent="moveMenuRowFocus(-1)"
              >
                <SaplingTextField
                  class="sapling-field-table-picker__search"
                  :model-value="props.searchValue"
                  :label="props.searchLabel || props.label"
                  :hint="props.searchHint"
                  :persistent-hint="Boolean(props.searchHint)"
                  :prepend-inner-icon="props.searchIcon"
                  clearable
                  autofocus
                  autocomplete="off"
                  hide-details="auto"
                  @keydown.down.prevent="focusFirstMenuRow"
                  @update:model-value="emit('update:search', $event ?? '')"
                />

                <div
                  class="glass-panel sapling-menu-surface sapling-menu-surface--field-table sapling-menu-surface--field-table-fullscreen sapling-nested-backdrop-host"
                  @mousedown.capture="emit('surface-mousedown')"
                >
                  <slot />
                </div>
              </div>
            </template>
          </SaplingDialogShell>
        </SaplingDialogCard>
      </SaplingDialog>
    </template>

    <v-menu
      v-else
      v-model="model"
      width="min(600px, calc(100vw - 2rem))"
      max-width="min(600px, calc(100vw - 2rem))"
      :max-height="menuMaxHeight"
      :close-on-content-click="false"
      :open-on-click="props.openOnClick"
      :location="menuLocation"
      :offset="pickerGap"
      scroll-strategy="reposition"
    >
      <template #activator="{ props: activatorProps }">
        <div ref="activatorRef" class="sapling-field-table-picker__activator">
          <slot name="activator" :props="activatorProps" :focus-first-result="focusFirstMenuRow" />
        </div>
      </template>

      <div
        ref="menuSurfaceRef"
        class="glass-panel sapling-menu-surface sapling-menu-surface--field-table sapling-nested-backdrop-host"
        v-css-vars="menuSurfaceStyle"
        @focusout="closeMenuWhenFocusLeaves"
        @keydown.tab.capture="closeMenuOnTab"
        @keydown.esc="closeMenuOnEscape"
        @keydown.down.prevent="moveMenuRowFocus(1)"
        @keydown.up.prevent="moveMenuRowFocus(-1)"
        @mousedown.capture="emit('surface-mousedown')"
      >
        <slot />
      </div>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import { useSaplingFieldDropdownFocus } from '@/composables/fields/useSaplingFieldDropdownFocus'

const DEFAULT_VIEWPORT_MARGIN = 16
const DEFAULT_PICKER_GAP = 4
const DEFAULT_MIN_USABLE_HEIGHT = 240
const DEFAULT_MAX_HEIGHT = 400
const FULLSCREEN_MAX_VIEWPORT_WIDTH = 600

const props = withDefaults(
  defineProps<{
    label: string
    searchValue?: string
    searchLabel?: string
    searchHint?: string
    searchIcon?: string
    openOnClick?: boolean
  }>(),
  {
    searchValue: '',
    searchLabel: '',
    searchHint: '',
    searchIcon: 'mdi-magnify',
    openOnClick: false,
  },
)

const emit = defineEmits<{
  (event: 'update:search', value: string): void
  (event: 'surface-mousedown'): void
}>()

const model = defineModel<boolean>({ required: true })
const pickerDialogId = `sapling-field-table-picker-${useId()}`
const activatorRef = ref<HTMLElement | null>(null)
const usesFullscreenPicker = ref(getViewport().width <= FULLSCREEN_MAX_VIEWPORT_WIDTH)
const menuLocation = ref<'bottom start' | 'top start'>('bottom start')
const availableMenuHeight = ref(DEFAULT_MAX_HEIGHT)
let animationFrame = -1

const {
  fieldRootRef,
  menuSurfaceRef,
  closeMenuOnTab,
  closeMenuOnEscape,
  closeMenuWhenFocusLeaves,
  focusFirstMenuRow,
  moveMenuRowFocus,
} = useSaplingFieldDropdownFocus(model)

const pickerGap = computed(() => readPixelToken('--sapling-field-picker-gap', DEFAULT_PICKER_GAP))
const fullscreenActivatorProps = computed(() => ({
  'aria-controls': pickerDialogId,
  'aria-expanded': model.value,
  'aria-haspopup': 'dialog',
  ...(props.openOnClick ? { onClick: openPicker } : {}),
}))
const menuMaxHeight = computed(() => `${Math.max(0, Math.floor(availableMenuHeight.value))}px`)
const menuSurfaceStyle = computed(() => ({
  '--sapling-field-picker-available-height': menuMaxHeight.value,
}))

function getViewport() {
  const visualViewport = window.visualViewport
  return {
    top: visualViewport?.offsetTop ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
  }
}

function readPixelToken(name: string, fallback: number) {
  const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue(name)
  const parsedValue = Number.parseFloat(rawValue)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function updatePresentation() {
  const viewport = getViewport()
  if (viewport.width <= FULLSCREEN_MAX_VIEWPORT_WIDTH) {
    usesFullscreenPicker.value = true
    return
  }

  const activator = activatorRef.value
  if (!activator) {
    usesFullscreenPicker.value = false
    return
  }

  const viewportMargin = readPixelToken(
    '--sapling-field-picker-viewport-margin',
    DEFAULT_VIEWPORT_MARGIN,
  )
  const minimumUsableHeight = readPixelToken(
    '--sapling-field-picker-min-usable-height',
    DEFAULT_MIN_USABLE_HEIGHT,
  )
  const maximumHeight = readPixelToken('--sapling-field-menu-max-height', DEFAULT_MAX_HEIGHT)
  const gap = pickerGap.value
  const viewportBottom = viewport.top + viewport.height
  const activatorBox = activator.getBoundingClientRect()
  const availableAbove = Math.max(0, activatorBox.top - viewport.top - viewportMargin - gap)
  const availableBelow = Math.max(0, viewportBottom - activatorBox.bottom - viewportMargin - gap)
  const bestAvailableHeight = Math.max(availableAbove, availableBelow)

  if (bestAvailableHeight < minimumUsableHeight) {
    usesFullscreenPicker.value = true
    return
  }

  usesFullscreenPicker.value = false
  const opensBelow = availableBelow >= minimumUsableHeight || availableBelow >= availableAbove
  menuLocation.value = opensBelow ? 'bottom start' : 'top start'
  availableMenuHeight.value = Math.min(maximumHeight, opensBelow ? availableBelow : availableAbove)
}

function schedulePresentationUpdate() {
  cancelAnimationFrame(animationFrame)
  animationFrame = requestAnimationFrame(() => {
    animationFrame = -1
    updatePresentation()
  })
}

function handleViewportChange() {
  if (model.value) {
    updatePresentation()
    schedulePresentationUpdate()
    return
  }

  usesFullscreenPicker.value = getViewport().width <= FULLSCREEN_MAX_VIEWPORT_WIDTH
}

function closePicker() {
  model.value = false
}

function openPicker() {
  model.value = true
}

watch(
  model,
  async (isOpen) => {
    if (!isOpen) {
      usesFullscreenPicker.value = getViewport().width <= FULLSCREEN_MAX_VIEWPORT_WIDTH
      return
    }

    updatePresentation()
    await nextTick()
    schedulePresentationUpdate()
  },
  { flush: 'sync' },
)

onMounted(() => {
  handleViewportChange()
  window.addEventListener('resize', handleViewportChange, { passive: true })
  window.addEventListener('scroll', handleViewportChange, { passive: true, capture: true })
  window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true })
  window.visualViewport?.addEventListener('scroll', handleViewportChange, { passive: true })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, { capture: true })
  window.visualViewport?.removeEventListener('resize', handleViewportChange)
  window.visualViewport?.removeEventListener('scroll', handleViewportChange)
})
</script>
