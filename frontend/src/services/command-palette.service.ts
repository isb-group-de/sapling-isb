export const SAPLING_OPEN_COMMAND_PALETTE_EVENT = 'sapling:open-command-palette'

export function openSaplingCommandPalette() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(SAPLING_OPEN_COMMAND_PALETTE_EVENT))
}
