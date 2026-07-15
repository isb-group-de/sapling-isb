import type { KPIItem } from '@/entity/entity'
import type { Component } from 'vue'

export type PlaygroundMessageType = 'error' | 'warning' | 'success' | 'info'

export type PlaygroundMetric = {
  label: string
  value: number
}

export type PlaygroundActionCard = {
  key: string
  title: string
  description: string
  component: Component
  props: Record<string, unknown>
  listeners?: Record<string, (...args: unknown[]) => void>
}

export type PlaygroundDialogLauncher = {
  key: string
  title: string
  description: string
  icon: string
  color: string
  disabled?: boolean
  open: () => void
}

export type PlaygroundKpiCard = {
  handle: number
  index: number
  kpi: KPIItem | null
  isLoading: boolean
}
