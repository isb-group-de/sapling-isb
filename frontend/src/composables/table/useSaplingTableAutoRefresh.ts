import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export const SAPLING_TABLE_AUTO_REFRESH_INTERVALS = [1, 5, 10] as const

export type SaplingTableAutoRefreshInterval = (typeof SAPLING_TABLE_AUTO_REFRESH_INTERVALS)[number]

/**
 * Keeps automatic table refresh local to the mounted table instance.
 * Polling pauses while the browser tab is hidden and is discarded on unmount.
 */
export function useSaplingTableAutoRefresh(
  refresh: () => void,
  isPaused: () => boolean = () => false,
) {
  const autoRefreshIntervalMinutes = ref<SaplingTableAutoRefreshInterval | null>(null)
  const secondsUntilRefresh = ref<number | null>(null)
  let refreshIntervalId: number | null = null
  let countdownIntervalId: number | null = null
  let nextRefreshAt: number | null = null

  function stopTimer(): void {
    if (refreshIntervalId !== null) {
      window.clearInterval(refreshIntervalId)
      refreshIntervalId = null
    }

    if (countdownIntervalId !== null) {
      window.clearInterval(countdownIntervalId)
      countdownIntervalId = null
    }

    nextRefreshAt = null
    secondsUntilRefresh.value = null
  }

  function isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible'
  }

  function runRefresh(): void {
    if (!isPaused()) {
      refresh()
    }
  }

  function updateCountdown(): void {
    if (nextRefreshAt === null) {
      secondsUntilRefresh.value = null
      return
    }

    secondsUntilRefresh.value = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1_000))
  }

  function startTimer(): void {
    stopTimer()

    const intervalMinutes = autoRefreshIntervalMinutes.value
    if (
      intervalMinutes === null ||
      typeof window === 'undefined' ||
      !isDocumentVisible() ||
      isPaused()
    ) {
      return
    }

    const intervalMs = intervalMinutes * 60_000
    nextRefreshAt = Date.now() + intervalMs
    updateCountdown()

    refreshIntervalId = window.setInterval(() => {
      nextRefreshAt = Date.now() + intervalMs
      updateCountdown()
      runRefresh()
    }, intervalMs)
    countdownIntervalId = window.setInterval(updateCountdown, 1_000)
  }

  function setAutoRefreshInterval(intervalMinutes: SaplingTableAutoRefreshInterval | null): void {
    autoRefreshIntervalMinutes.value = intervalMinutes
    startTimer()
  }

  function onVisibilityChange(): void {
    stopTimer()

    if (autoRefreshIntervalMinutes.value === null || !isDocumentVisible()) {
      return
    }

    runRefresh()
    startTimer()
  }

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    startTimer()
  })

  onBeforeUnmount(() => {
    stopTimer()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  watch(isPaused, (paused) => {
    if (paused) {
      stopTimer()
      return
    }

    startTimer()
  })

  return {
    autoRefreshIntervalMinutes,
    secondsUntilRefresh,
    setAutoRefreshInterval,
    restartAutoRefreshTimer: startTimer,
  }
}
