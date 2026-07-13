import type { CSSProperties } from 'vue'

type RgbColor = {
  r: number
  g: number
  b: number
}

type SaplingCssVars = CSSProperties & Record<`--${string}`, string>

const DARK_TEXT_MIX_WEIGHT = 0.84
const LIGHT_TEXT_MIX_WEIGHT = 0.58

export function resolveSaplingSoftBadgeStyle(color?: string | null): SaplingCssVars | undefined {
  const normalizedColor = color?.trim()
  if (!normalizedColor) {
    return undefined
  }

  const rgb = parseCssRgbColor(normalizedColor)
  if (!rgb) {
    return {
      '--sapling-soft-badge-accent': normalizedColor,
      '--sapling-soft-badge-background': `color-mix(in srgb, ${normalizedColor} 24%, transparent)`,
      '--sapling-soft-badge-border': `color-mix(in srgb, ${normalizedColor} 46%, transparent)`,
      '--sapling-soft-badge-foreground': `color-mix(in srgb, ${normalizedColor} 70%, white)`,
    }
  }

  return {
    '--sapling-soft-badge-accent': rgbToCss(rgb),
    '--sapling-soft-badge-background': rgbaToCss(rgb, 0.24),
    '--sapling-soft-badge-border': rgbaToCss(rgb, 0.46),
    '--sapling-soft-badge-foreground': getReadableSoftBadgeForeground(rgb),
  }
}

function getReadableSoftBadgeForeground(color: RgbColor): string {
  if (getPerceivedBrightness(color) > 170) {
    return rgbToCss(mixRgb(color, { r: 0, g: 0, b: 0 }, DARK_TEXT_MIX_WEIGHT))
  }

  return rgbToCss(mixRgb(color, { r: 255, g: 255, b: 255 }, LIGHT_TEXT_MIX_WEIGHT))
}

function parseCssRgbColor(value: string): RgbColor | null {
  const hexColor = parseHexColor(value)
  if (hexColor) {
    return hexColor
  }

  return parseRgbFunctionColor(value)
}

function parseHexColor(value: string): RgbColor | null {
  const match = value.match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i)
  if (!match) {
    return null
  }

  const hex = match[1]
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    }
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

function parseRgbFunctionColor(value: string): RgbColor | null {
  const match = value.match(/^rgba?\(([^)]+)\)$/i)
  if (!match) {
    return null
  }

  const channels = match[1]
    .split(',')
    .slice(0, 3)
    .map((channel) => Number.parseFloat(channel.trim()))

  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return null
  }

  return {
    r: clampColorChannel(channels[0]),
    g: clampColorChannel(channels[1]),
    b: clampColorChannel(channels[2]),
  }
}

function getPerceivedBrightness(color: RgbColor): number {
  return color.r * 0.299 + color.g * 0.587 + color.b * 0.114
}

function mixRgb(left: RgbColor, right: RgbColor, leftWeight: number): RgbColor {
  const rightWeight = 1 - leftWeight

  return {
    r: clampColorChannel(left.r * leftWeight + right.r * rightWeight),
    g: clampColorChannel(left.g * leftWeight + right.g * rightWeight),
    b: clampColorChannel(left.b * leftWeight + right.b * rightWeight),
  }
}

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToCss(color: RgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function rgbaToCss(color: RgbColor, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}
