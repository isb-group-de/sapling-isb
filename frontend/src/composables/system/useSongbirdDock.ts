import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingAiChat } from './useSaplingAiChat'

const width = ref(420)
const viewport = ref(window.innerWidth)
const expanded = ref(false)
export function useSongbirdDock() {
  const { isOpen, hasSaplingAiChatAccess } = useSaplingAiChat()
  const person = useCurrentPersonStore()
  const storageKey = computed(() => `songbird-panel-width:${person.person?.handle ?? 'anonymous'}`)
  const fullscreen = computed(() => expanded.value || viewport.value < width.value + 720)
  const active = computed(() => isOpen.value && hasSaplingAiChatAccess.value)
  const docked = computed(() => active.value && !fullscreen.value)
  const showSessionSidebar = computed(() => fullscreen.value && viewport.value >= 1200)
  function setWidth(value: number) {
    width.value = Math.round(Math.min(640, Math.max(360, value)))
    try {
      localStorage.setItem(storageKey.value, String(width.value))
    } catch {
      /* Storage is optional. */
    }
  }
  function updateViewport() {
    viewport.value = window.innerWidth
  }
  onMounted(() => window.addEventListener('resize', updateViewport))
  onUnmounted(() => window.removeEventListener('resize', updateViewport))
  watch(
    storageKey,
    (key) => {
      try {
        const stored = Number(localStorage.getItem(key))
        width.value = stored >= 360 && stored <= 640 ? stored : 420
      } catch {
        width.value = 420
      }
    },
    { immediate: true },
  )
  return { width, fullscreen, docked, active, expanded, setWidth, showSessionSidebar }
}
