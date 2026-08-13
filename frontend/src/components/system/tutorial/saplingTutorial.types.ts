export type SaplingTutorialStep = {
  id: string
  target: string
  title: string
  description: string
  icon?: string
  allowInteraction?: boolean
  advanceOnTargetClick?: boolean
  optional?: boolean
}
