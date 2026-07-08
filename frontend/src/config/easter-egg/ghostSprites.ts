export type GhostPose = 'idle' | 'blink' | 'happy' | 'jump' | 'wave' | 'hidden'

export const ghostPoseClass: Record<GhostPose, string> = {
  idle: 'sapling-ghost--pose-idle',
  blink: 'sapling-ghost--pose-blink',
  happy: 'sapling-ghost--pose-happy',
  jump: 'sapling-ghost--pose-jump',
  wave: 'sapling-ghost--pose-wave',
  hidden: 'sapling-ghost--pose-hidden',
}
