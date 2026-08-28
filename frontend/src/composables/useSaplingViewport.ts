import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DEFAULT_SMALL_WINDOW_WIDTH } from '@/constants/project.constants'

/**
 * Exposes the application viewport boundary shared with the mobile table layout.
 */
export function useSaplingViewport() {
  const viewportWidth = ref(
    typeof window === 'undefined' ? DEFAULT_SMALL_WINDOW_WIDTH : window.innerWidth,
  )

  function updateViewportWidth(): void {
    viewportWidth.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', updateViewportWidth, { passive: true })
    updateViewportWidth()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewportWidth)
  })

  return {
    viewportWidth,
    isSmallViewport: computed(() => viewportWidth.value < DEFAULT_SMALL_WINDOW_WIDTH),
  }
}
