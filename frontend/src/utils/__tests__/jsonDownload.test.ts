import { describe, expect, it } from 'vitest'
import { createJsonDownloadFilename } from '@/utils/jsonDownload'

describe('createJsonDownloadFilename', () => {
  it('removes required markers and filesystem-unsafe characters', () => {
    expect(createJsonDownloadFilename(' Payload:* ')).toBe('Payload.json')
  })

  it('uses a stable fallback for labels without a usable filename', () => {
    expect(createJsonDownloadFilename('***', 'payload')).toBe('payload.json')
  })
})
