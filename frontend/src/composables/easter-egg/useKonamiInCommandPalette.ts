import { ref } from 'vue'
import { useGhostEasterEgg } from '@/composables/easter-egg/useGhostEasterEgg'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { ghostActivationMessage, ghostDeactivationMessage } from '@/config/easter-egg/ghostMessages'

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'B',
  'A',
] as const

export function useKonamiInCommandPalette() {
  const progress = ref(0)
  const ghost = useGhostEasterEgg()
  const { pushMessage } = useSaplingMessageCenter()

  function handleCommandPaletteKeydown(event: KeyboardEvent) {
    const key = normalizeKey(event)
    const expected = KONAMI_SEQUENCE[progress.value]

    if (key === expected) {
      progress.value += 1

      if (progress.value === KONAMI_SEQUENCE.length) {
        progress.value = 0
        const result = ghost.toggle()
        if (result.changed) {
          pushMessage(
            'info',
            result.active ? ghostActivationMessage : ghostDeactivationMessage,
            '',
            'ghostEasterEgg',
          )
        }
      }

      return true
    }

    progress.value = key === KONAMI_SEQUENCE[0] ? 1 : 0
    return key === KONAMI_SEQUENCE[0]
  }

  function resetKonamiProgress() {
    progress.value = 0
  }

  return {
    handleCommandPaletteKeydown,
    resetKonamiProgress,
  }
}

function normalizeKey(event: KeyboardEvent) {
  if (event.key.length === 1) {
    return event.key.toUpperCase()
  }

  return event.key
}
