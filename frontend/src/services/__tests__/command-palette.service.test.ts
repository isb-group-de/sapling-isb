import { describe, expect, it, vi } from 'vitest'
import {
  SAPLING_CLOSE_COMMAND_PALETTE_EVENT,
  SAPLING_OPEN_COMMAND_PALETTE_EVENT,
  closeSaplingCommandPalette,
  openSaplingCommandPalette,
} from '@/services/command-palette.service'

describe('command palette service', () => {
  it.each([
    [SAPLING_OPEN_COMMAND_PALETTE_EVENT, openSaplingCommandPalette],
    [SAPLING_CLOSE_COMMAND_PALETTE_EVENT, closeSaplingCommandPalette],
  ])('dispatches %s', (eventName, dispatch) => {
    const listener = vi.fn()
    window.addEventListener(eventName, listener)

    dispatch()

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(eventName, listener)
  })
})
