import { ref } from 'vue'
import CookieService from '@/services/cookie.service'

const TUTORIAL_COOKIE_PREFIX = 'tutorial-'
const TUTORIAL_COOKIE_MAX_AGE_DAYS = 365 * 5

type SaplingTutorialOptions = {
  id: string
  version: number
}

export function useSaplingTutorial(options: SaplingTutorialOptions) {
  const isActive = ref(false)

  function start(optionsOverride: { force?: boolean } = {}) {
    if (!optionsOverride.force && hasSeenTutorial(options.id, options.version)) {
      return false
    }

    isActive.value = true
    return true
  }

  function finish() {
    rememberTutorial(options.id, options.version)
    isActive.value = false
  }

  function dismiss() {
    rememberTutorial(options.id, options.version)
    isActive.value = false
  }

  function stop() {
    isActive.value = false
  }

  return {
    isActive,
    start,
    finish,
    dismiss,
    stop,
  }
}

export function hasSeenTutorial(id: string, version: number): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  return CookieService.get(getTutorialCookieName(id)) === String(version)
}

export function rememberTutorial(id: string, version: number) {
  if (typeof document === 'undefined') {
    return
  }

  CookieService.set(getTutorialCookieName(id), String(version), TUTORIAL_COOKIE_MAX_AGE_DAYS)
}

function getTutorialCookieName(id: string) {
  const safeId = id.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  return `${TUTORIAL_COOKIE_PREFIX}${safeId}`
}
