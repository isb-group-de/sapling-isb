export type SaplingFeatureTutorial = 'table' | 'partner' | 'calendar'

export const SAPLING_START_FEATURE_TUTORIAL_EVENT = 'sapling:start-feature-tutorial'

const pendingTutorials = new Set<SaplingFeatureTutorial>()

export function startSaplingFeatureTutorial(tutorial: SaplingFeatureTutorial) {
  if (typeof window === 'undefined') {
    return
  }

  pendingTutorials.add(tutorial)
  window.dispatchEvent(
    new CustomEvent<SaplingFeatureTutorial>(SAPLING_START_FEATURE_TUTORIAL_EVENT, {
      detail: tutorial,
    }),
  )
}

export function consumePendingSaplingFeatureTutorial(tutorial: SaplingFeatureTutorial) {
  if (!pendingTutorials.has(tutorial)) {
    return false
  }

  pendingTutorials.delete(tutorial)
  return true
}
