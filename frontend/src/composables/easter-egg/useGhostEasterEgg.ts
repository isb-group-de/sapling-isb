import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ghostEasterEggConfig,
  type GhostEasterEggConfig,
} from '@/config/easter-egg/ghostEasterEggConfig'
import { ghostActivationMessage, ghostMessages } from '@/config/easter-egg/ghostMessages'
import type { GhostPose } from '@/config/easter-egg/ghostSprites'

export type GhostEasterEggStatus =
  'inactive' | 'appearing' | 'active' | 'jumping' | 'disappearing' | 'hidden'

const STORAGE_KEY = 'sapling.ghostEasterEgg.active'
const APPEARANCE_MS = 420
const JUMP_MS = 760

const status = ref<GhostEasterEggStatus>('inactive')
const pose = ref<GhostPose>('hidden')
const message = ref('')
const isMessageVisible = ref(false)
const config = ref<GhostEasterEggConfig>({ ...ghostEasterEggConfig })

let initialized = false
let mountedConsumers = 0
let transitionTimer: ReturnType<typeof setTimeout> | null = null
let messageTimer: ReturnType<typeof setTimeout> | null = null
let randomMessageTimer: ReturnType<typeof setTimeout> | null = null
let blinkTimer: ReturnType<typeof setTimeout> | null = null
let blinkResetTimer: ReturnType<typeof setTimeout> | null = null

export function useGhostEasterEgg(options?: Partial<GhostEasterEggConfig>) {
  if (options) {
    config.value = { ...config.value, ...options }
  }

  const isVisible = computed(
    () => config.value.enabled && status.value !== 'inactive' && status.value !== 'hidden',
  )
  const isActive = computed(
    () => status.value === 'appearing' || status.value === 'active' || status.value === 'jumping',
  )
  const sizePx = computed(() => `${config.value.size}px`)
  const idleRadiusPx = computed(() => `${config.value.idleRadiusPx}px`)

  function initialize() {
    if (initialized) {
      return
    }
    initialized = true

    if (!config.value.enabled) {
      status.value = 'hidden'
      pose.value = 'hidden'
      return
    }

    if (readPersistedActive()) {
      status.value = 'appearing'
      pose.value = 'idle'
      setTransition(() => {
        status.value = 'active'
        scheduleRandomMessage()
        scheduleBlink()
      }, APPEARANCE_MS)
      return
    }

    status.value = 'hidden'
    pose.value = 'hidden'
  }

  function activate() {
    if (!config.value.enabled || isActive.value) {
      return false
    }

    writePersistedActive(true)
    clearTransition()
    status.value = 'appearing'
    pose.value = 'happy'
    showMessage(ghostActivationMessage)
    setTransition(() => {
      status.value = 'active'
      pose.value = 'idle'
      scheduleRandomMessage()
      scheduleBlink()
    }, APPEARANCE_MS)
    return true
  }

  function deactivate() {
    if (!isActive.value && status.value !== 'disappearing') {
      return false
    }

    writePersistedActive(false)
    clearTransition()
    clearRandomMessage()
    clearBlink()
    hideMessage()
    status.value = 'disappearing'
    pose.value = 'hidden'
    setTransition(() => {
      status.value = 'hidden'
    }, APPEARANCE_MS)
    return true
  }

  function toggle() {
    return isActive.value
      ? { active: false, changed: deactivate() }
      : { active: true, changed: activate() }
  }

  function handleGhostClick() {
    if (status.value !== 'active') {
      return
    }

    clearTransition()
    status.value = 'jumping'
    pose.value = Math.random() > 0.45 ? 'happy' : 'wave'
    showMessage(pickMessage())
    setTransition(() => {
      status.value = 'active'
      pose.value = 'idle'
      scheduleBlink()
    }, JUMP_MS)
  }

  function showMessage(value: string) {
    if (!value) {
      return
    }

    clearMessageTimer()
    message.value = value
    isMessageVisible.value = true
    messageTimer = setTimeout(hideMessage, config.value.messageVisibleMs)
  }

  function hideMessage() {
    clearMessageTimer()
    isMessageVisible.value = false
  }

  function scheduleRandomMessage() {
    clearRandomMessage()
    if (!isActive.value) {
      return
    }

    const [min, max] = config.value.randomMessageIntervalMs
    const delay = randomInt(Math.min(min, max), Math.max(min, max))
    randomMessageTimer = setTimeout(() => {
      if (status.value === 'active') {
        showMessage(pickMessage())
      }
      scheduleRandomMessage()
    }, delay)
  }

  function scheduleBlink() {
    clearBlink()
    if (status.value !== 'active') {
      return
    }

    blinkTimer = setTimeout(
      () => {
        if (status.value !== 'active') {
          return
        }

        pose.value = 'blink'
        blinkResetTimer = setTimeout(() => {
          blinkResetTimer = null
          if (status.value === 'active' && pose.value === 'blink') {
            pose.value = 'idle'
          }
          scheduleBlink()
        }, 180)
      },
      randomInt(4500, 9000),
    )
  }

  function cleanup() {
    clearTransition()
    clearMessageTimer()
    clearRandomMessage()
    clearBlink()
  }

  onMounted(() => {
    mountedConsumers += 1
    initialize()
  })
  onBeforeUnmount(() => {
    mountedConsumers = Math.max(0, mountedConsumers - 1)
    if (mountedConsumers > 0) {
      return
    }

    cleanup()
    initialized = false
    status.value = 'inactive'
    pose.value = 'hidden'
    message.value = ''
    isMessageVisible.value = false
    config.value = { ...ghostEasterEggConfig }
  })

  return {
    status,
    pose,
    message,
    isMessageVisible,
    isVisible,
    isActive,
    sizePx,
    idleRadiusPx,
    config,
    activate,
    deactivate,
    toggle,
    handleGhostClick,
    showMessage,
  }
}

function readPersistedActive() {
  if (!config.value.persistState || typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

function writePersistedActive(value: boolean) {
  if (!config.value.persistState || typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
}

function pickMessage() {
  return ghostMessages[Math.floor(Math.random() * ghostMessages.length)] ?? ''
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function setTransition(callback: () => void, delay: number) {
  clearTransition()
  transitionTimer = setTimeout(() => {
    transitionTimer = null
    callback()
  }, delay)
}

function clearTransition() {
  if (!transitionTimer) {
    return
  }

  clearTimeout(transitionTimer)
  transitionTimer = null
}

function clearMessageTimer() {
  if (!messageTimer) {
    return
  }

  clearTimeout(messageTimer)
  messageTimer = null
}

function clearRandomMessage() {
  if (!randomMessageTimer) {
    return
  }

  clearTimeout(randomMessageTimer)
  randomMessageTimer = null
}

function clearBlink() {
  if (!blinkTimer) {
    return
  }

  clearTimeout(blinkTimer)
  blinkTimer = null
  if (blinkResetTimer) {
    clearTimeout(blinkResetTimer)
    blinkResetTimer = null
  }
}
