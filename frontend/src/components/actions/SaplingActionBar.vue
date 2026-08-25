<template>
  <div
    class="sapling-dialog__footer sapling-action-bar"
    :class="{ 'sapling-action-bar--compact': isCompact }"
  >
    <v-card-actions ref="contentRef" class="sapling-dialog__actions sapling-action-bar__content">
      <div
        v-if="$slots.leading"
        class="sapling-action-bar__group sapling-action-bar__group--leading"
      >
        <slot name="leading" />
      </div>

      <div class="sapling-action-bar__spacer"></div>

      <div
        v-if="$slots.trailing"
        class="sapling-action-bar__group sapling-action-bar__group--trailing"
      >
        <slot name="trailing" />
      </div>
    </v-card-actions>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'

type ElementRef = HTMLElement | (ComponentPublicInstance & { $el: HTMLElement }) | null

const contentRef = ref<ElementRef>(null)
const isCompact = ref(false)
let expandedRequiredWidth = 0
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

function resolveContentElement(): HTMLElement | null {
  const value = contentRef.value
  if (!value) return null
  return value instanceof HTMLElement ? value : value.$el
}

function numericGap(element: HTMLElement): number {
  const rawGap = Number.parseFloat(getComputedStyle(element).columnGap)
  return Number.isFinite(rawGap) ? rawGap : 0
}

function requiredGroupWidth(group: HTMLElement): number {
  const children = Array.from(group.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )
  if (children.length === 0) return 0

  const childrenWidth = children.reduce(
    (width, child) => width + Math.max(child.getBoundingClientRect().width, child.scrollWidth),
    0,
  )
  return childrenWidth + numericGap(group) * (children.length - 1)
}

function measureExpandedRequiredWidth(content: HTMLElement): number {
  const directChildren = Array.from(content.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )
  const groupWidth = directChildren.reduce((width, child) => {
    if (child.classList.contains('sapling-action-bar__group')) {
      return width + requiredGroupWidth(child)
    }
    if (child.classList.contains('sapling-action-bar__spacer')) {
      return width
    }
    return width + Math.max(child.getBoundingClientRect().width, child.scrollWidth)
  }, 0)

  return groupWidth + numericGap(content) * Math.max(0, directChildren.length - 1)
}

async function measureActionBar(): Promise<void> {
  const content = resolveContentElement()
  if (!content) return

  if (isCompact.value) {
    if (content.clientWidth + 1 < expandedRequiredWidth) return

    isCompact.value = false
    await nextTick()
  }

  expandedRequiredWidth = measureExpandedRequiredWidth(content)
  isCompact.value = expandedRequiredWidth > content.clientWidth + 1
}

async function remeasureExpandedContent(): Promise<void> {
  if (isCompact.value) {
    isCompact.value = false
    await nextTick()
  }
  await measureActionBar()
}

onMounted(async () => {
  await nextTick()
  const content = resolveContentElement()
  if (!content) return

  resizeObserver = new ResizeObserver(() => {
    void measureActionBar()
  })
  resizeObserver.observe(content)

  mutationObserver = new MutationObserver(() => {
    void remeasureExpandedContent()
  })
  mutationObserver.observe(content, {
    childList: true,
    characterData: true,
    subtree: true,
  })

  await measureActionBar()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
})
</script>
