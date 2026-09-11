import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Ghost Easter egg integration', () => {
  it('stays attached to the Songbird launcher', () => {
    const songbirdSource = readFileSync(
      join(process.cwd(), 'src/components/system/SaplingAiChat.vue'),
      'utf8',
    )

    expect(songbirdSource).toContain('<GhostEasterEgg')
    expect(songbirdSource).toContain('useGhostEasterEgg()')
    expect(songbirdSource).toContain('!isGhostEasterEggActive')
  })
})
