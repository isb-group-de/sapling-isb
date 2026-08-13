<template>
  <Teleport to="body">
    <div
      v-if="modelValue && currentStep"
      class="sapling-tutorial"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="descriptionId"
    >
      <div
        v-for="(area, index) in dimmedAreas"
        :key="`area-${index}`"
        class="sapling-tutorial__scrim"
        :style="area"
        aria-hidden="true"
        @click.stop
      />
      <div
        v-for="corner in roundedCornerAreas"
        :key="corner.position"
        class="sapling-tutorial__scrim sapling-tutorial__scrim-corner"
        :class="`sapling-tutorial__scrim-corner--${corner.position}`"
        :style="corner.style"
        aria-hidden="true"
        @click.stop
      />

      <div
        v-if="isPositioned"
        class="sapling-tutorial__spotlight"
        :class="{ 'sapling-tutorial__spotlight--interactive': currentStep.allowInteraction }"
        :style="spotlightStyle"
        aria-hidden="true"
        @click.stop="handleSpotlightClick"
      />

      <section
        ref="panelRef"
        class="sapling-tutorial__panel"
        :class="`sapling-tutorial__panel--${panelPlacement}`"
        :style="panelStyle"
        tabindex="-1"
      >
        <div class="sapling-tutorial__panel-header">
          <div class="sapling-tutorial__heading">
            <span v-if="currentStep.icon" class="sapling-tutorial__icon">
              <v-icon :icon="currentStep.icon" size="20" />
            </span>
            <div>
              <p class="sapling-tutorial__eyebrow">
                {{ t('tutorial.step', { current: currentIndex + 1, total: steps.length }) }}
              </p>
              <h2 :id="titleId">{{ currentStep.title }}</h2>
            </div>
          </div>
          <v-btn
            variant="text"
            density="comfortable"
            size="small"
            icon="mdi-close"
            :aria-label="t('tutorial.end')"
            :title="t('tutorial.end')"
            @click="dismiss"
          />
        </div>

        <p :id="descriptionId" class="sapling-tutorial__description">
          {{ currentStep.description }}
        </p>

        <div class="sapling-tutorial__footer">
          <div class="sapling-tutorial__progress" aria-hidden="true">
            <span
              v-for="(_, index) in steps"
              :key="index"
              :class="{ 'sapling-tutorial__progress-dot--active': index === currentIndex }"
            />
          </div>

          <div class="sapling-tutorial__actions">
            <v-btn v-if="currentIndex > 0" variant="text" size="small" @click="previous">
              {{ t('tutorial.back') }}
            </v-btn>
            <v-btn
              v-if="!currentStep.advanceOnTargetClick"
              color="primary"
              size="small"
              append-icon="mdi-arrow-right"
              @click="next"
            >
              {{ isLastStep ? doneLabel || t('tutorial.done') : t('tutorial.next') }}
            </v-btn>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CSSProperties } from 'vue'
import type { SaplingTutorialStep } from './saplingTutorial.types'

const props = defineProps<{
  modelValue: boolean
  steps: SaplingTutorialStep[]
  doneLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  finish: []
  dismiss: []
  stepChange: [step: SaplingTutorialStep, index: number]
}>()

const { t } = useI18n()
const currentIndex = ref(0)
const panelRef = ref<HTMLElement | null>(null)
const targetRect = ref<DOMRect | null>(null)
const panelStyle = ref<CSSProperties>({ visibility: 'hidden' })
const panelPlacement = ref<'above' | 'below'>('below')
const resizeObserver = ref<ResizeObserver | null>(null)
const observedTarget = ref<Element | null>(null)
const interactiveTarget = ref<Element | null>(null)
let targetTrackingFrame: number | null = null
let lastObservedBounds: DOMRect | null = null

const currentStep = computed(() => props.steps[currentIndex.value])
const isLastStep = computed(() => currentIndex.value === props.steps.length - 1)
const isPositioned = computed(() => targetRect.value !== null)
const titleId = computed(() => `sapling-tutorial-${currentStep.value?.id ?? 'step'}-title`)
const descriptionId = computed(
  () => `sapling-tutorial-${currentStep.value?.id ?? 'step'}-description`,
)

const spotlightStyle = computed<CSSProperties>(() => {
  const rect = targetRect.value
  if (!rect) {
    return { visibility: 'hidden' }
  }

  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

const dimmedAreas = computed<CSSProperties[]>(() => {
  const rect = targetRect.value
  if (!rect) {
    return [{ inset: '0' }]
  }

  return [
    { top: '0', left: '0', right: '0', height: `${rect.top}px` },
    { top: `${rect.top}px`, left: '0', width: `${rect.left}px`, height: `${rect.height}px` },
    {
      top: `${rect.top}px`,
      left: `${rect.right}px`,
      right: '0',
      height: `${rect.height}px`,
    },
    { top: `${rect.bottom}px`, left: '0', right: '0', bottom: '0' },
  ]
})

const roundedCornerAreas = computed<
  Array<{
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    style: CSSProperties
  }>
>(() => {
  const rect = targetRect.value
  if (!rect) {
    return []
  }

  return [
    {
      position: 'top-left',
      style: { top: `${rect.top}px`, left: `${rect.left}px` },
    },
    {
      position: 'top-right',
      style: {
        top: `${rect.top}px`,
        left: `calc(${rect.right}px - var(--sapling-radius-md))`,
      },
    },
    {
      position: 'bottom-left',
      style: {
        top: `calc(${rect.bottom}px - var(--sapling-radius-md))`,
        left: `${rect.left}px`,
      },
    },
    {
      position: 'bottom-right',
      style: {
        top: `calc(${rect.bottom}px - var(--sapling-radius-md))`,
        left: `calc(${rect.right}px - var(--sapling-radius-md))`,
      },
    },
  ]
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      currentIndex.value = 0
      window.addEventListener('keydown', onKeydown)
      window.addEventListener('resize', schedulePosition)
      window.addEventListener('scroll', schedulePosition, true)
      emitCurrentStep()
      void positionCurrentStep(true)
    } else {
      removeListeners()
    }
  },
  { immediate: true },
)

watch(currentIndex, () => {
  if (props.modelValue) {
    clearTargetInteraction()
    emitCurrentStep()
    void positionCurrentStep(true)
  }
})

watch(
  () => props.steps.length,
  (length) => {
    if (length === 0 && props.modelValue) {
      dismiss()
    } else if (currentIndex.value >= length) {
      currentIndex.value = Math.max(0, length - 1)
    }
  },
)

async function positionCurrentStep(scrollTarget = false, attempt = 0) {
  if (!props.modelValue) {
    return
  }

  await nextTick()
  const step = currentStep.value
  if (!step) {
    return
  }

  const target = document.querySelector(step.target)
  if (!target) {
    if (step.optional && attempt >= 90) {
      next()
      return
    }
    window.requestAnimationFrame(() => {
      if (props.modelValue) {
        void positionCurrentStep(false, attempt + 1)
      }
    })
    return
  }

  const targetBounds = target.getBoundingClientRect()
  if (targetBounds.width < 2 || targetBounds.height < 2) {
    if (step.optional && attempt >= 90) {
      next()
      return
    }
    window.requestAnimationFrame(() => {
      if (props.modelValue) {
        void positionCurrentStep(false, attempt + 1)
      }
    })
    return
  }

  observeTarget(target)
  bindTargetInteraction(target)
  startTargetTracking()
  if (scrollTarget) {
    target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }

  updateTargetRect(target)
  await nextTick()
  window.requestAnimationFrame(() => updatePanelPosition())
}

function updateTargetRect(target: Element) {
  const padding = 6
  const source = target.getBoundingClientRect()
  const top = Math.max(0, source.top - padding)
  const left = Math.max(0, source.left - padding)
  const right = Math.min(window.innerWidth, source.right + padding)
  const bottom = Math.min(window.innerHeight, source.bottom + padding)
  targetRect.value = new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top))
  lastObservedBounds = source
}

function updatePanelPosition() {
  const rect = targetRect.value
  const panel = panelRef.value
  if (!rect || !panel) {
    return
  }

  const viewportMargin = 12
  const targetGap = 16
  const panelRect = panel.getBoundingClientRect()
  const panelWidth = Math.min(
    panel.offsetWidth || panelRect.width || 400,
    window.innerWidth - viewportMargin * 2,
  )
  const panelHeight = panelRect.height || 220
  const left = clamp(
    rect.left + rect.width / 2 - panelWidth / 2,
    viewportMargin,
    window.innerWidth - panelWidth - viewportMargin,
  )
  const fitsBelow = rect.bottom + targetGap + panelHeight <= window.innerHeight - viewportMargin
  panelPlacement.value = fitsBelow ? 'below' : 'above'
  const top = fitsBelow
    ? rect.bottom + targetGap
    : Math.max(viewportMargin, rect.top - targetGap - panelHeight)
  const arrowLeft = clamp(rect.left + rect.width / 2 - left, 20, Math.max(20, panelWidth - 20))

  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    '--sapling-tutorial-arrow-left': `${arrowLeft}px`,
    visibility: 'visible',
  }
  panel.focus({ preventScroll: true })
}

function observeTarget(target: Element) {
  if (observedTarget.value === target) {
    return
  }

  resizeObserver.value?.disconnect()
  observedTarget.value = target
  lastObservedBounds = null
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver.value = new ResizeObserver(schedulePosition)
    resizeObserver.value.observe(target)
  }
}

function startTargetTracking() {
  if (targetTrackingFrame !== null) {
    return
  }

  targetTrackingFrame = window.requestAnimationFrame(trackTargetPosition)
}

function trackTargetPosition() {
  targetTrackingFrame = null
  const target = observedTarget.value
  if (!props.modelValue || !target?.isConnected) {
    return
  }

  const currentBounds = target.getBoundingClientRect()
  if (hasBoundsChanged(currentBounds, lastObservedBounds)) {
    updateTargetRect(target)
    updatePanelPosition()
  }

  targetTrackingFrame = window.requestAnimationFrame(trackTargetPosition)
}

function hasBoundsChanged(current: DOMRect, previous: DOMRect | null) {
  if (!previous) {
    return true
  }

  const tolerance = 0.25
  return (
    Math.abs(current.x - previous.x) > tolerance ||
    Math.abs(current.y - previous.y) > tolerance ||
    Math.abs(current.width - previous.width) > tolerance ||
    Math.abs(current.height - previous.height) > tolerance
  )
}

function bindTargetInteraction(target: Element) {
  if (!currentStep.value?.advanceOnTargetClick || interactiveTarget.value === target) {
    return
  }

  clearTargetInteraction()
  interactiveTarget.value = target
  target.addEventListener('click', handleTargetInteraction, { once: true })
}

function clearTargetInteraction() {
  interactiveTarget.value?.removeEventListener('click', handleTargetInteraction)
  interactiveTarget.value = null
}

function handleTargetInteraction() {
  window.setTimeout(() => {
    if (props.modelValue) {
      next()
    }
  }, 180)
}

function handleSpotlightClick() {
  if (!currentStep.value?.allowInteraction) {
    return
  }

  const target = interactiveTarget.value
  if (target instanceof HTMLElement) {
    target.click()
  }
}

function schedulePosition() {
  const target = observedTarget.value
  if (!target || !props.modelValue) {
    return
  }
  window.requestAnimationFrame(() => {
    updateTargetRect(target)
    updatePanelPosition()
  })
}

function previous() {
  currentIndex.value = Math.max(0, currentIndex.value - 1)
}

function emitCurrentStep() {
  const step = currentStep.value
  if (step) {
    emit('stepChange', step, currentIndex.value)
  }
}

function next() {
  if (isLastStep.value) {
    emit('finish')
    emit('update:modelValue', false)
    return
  }
  currentIndex.value += 1
}

function dismiss() {
  emit('dismiss')
  emit('update:modelValue', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    dismiss()
  } else if (event.key === 'ArrowRight' && !currentStep.value?.advanceOnTargetClick) {
    event.preventDefault()
    next()
  } else if (event.key === 'ArrowLeft' && currentIndex.value > 0) {
    event.preventDefault()
    previous()
  }
}

function removeListeners() {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', schedulePosition)
  window.removeEventListener('scroll', schedulePosition, true)
  resizeObserver.value?.disconnect()
  if (targetTrackingFrame !== null) {
    window.cancelAnimationFrame(targetTrackingFrame)
    targetTrackingFrame = null
  }
  clearTargetInteraction()
  observedTarget.value = null
  lastObservedBounds = null
  targetRect.value = null
  panelStyle.value = { visibility: 'hidden' }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

onBeforeUnmount(removeListeners)
</script>
