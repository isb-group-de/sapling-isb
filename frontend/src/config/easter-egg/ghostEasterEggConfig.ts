export type GhostEasterEggPosition = 'top-right'

export interface GhostEasterEggConfig {
  enabled: boolean
  persistState: boolean
  position: GhostEasterEggPosition
  size: number
  idleRadiusPx: number
  randomMessageIntervalMs: [number, number]
  messageVisibleMs: number
}

export const ghostEasterEggConfig: GhostEasterEggConfig = {
  enabled: true,
  persistState: true,
  position: 'top-right',
  size: 64,
  idleRadiusPx: 84,
  randomMessageIntervalMs: [60000, 120000],
  messageVisibleMs: 3500,
}
