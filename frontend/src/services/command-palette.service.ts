export const SAPLING_OPEN_COMMAND_PALETTE_EVENT = 'sapling:open-command-palette'
export const SAPLING_CLOSE_COMMAND_PALETTE_EVENT = 'sapling:close-command-palette'

export function openSaplingCommandPalette() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(SAPLING_OPEN_COMMAND_PALETTE_EVENT))
}

export function closeSaplingCommandPalette() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(SAPLING_CLOSE_COMMAND_PALETTE_EVENT))
}
