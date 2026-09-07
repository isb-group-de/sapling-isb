import { describe, expect, it } from 'vitest'
import { getPreviewType } from '../documentPreview'

describe('document preview formats', () => {
  it.each([
    ['image/svg+xml', 'logo', 'svg'],
    [' IMAGE/SVG+XML; charset=utf-8 ', 'logo', 'svg'],
    ['image/x-icon', 'favicon', 'ico'],
    ['image/vnd.microsoft.icon', 'favicon', 'ico'],
    ['application/octet-stream', 'Logo.SVG', 'svg'],
    ['', 'Favicon.ICO', 'ico'],
    ['text/xml', 'logo.svg', 'svg'],
    ['application/octet-stream', 'favicon.ico', 'ico'],
    ['application/octet-stream', 'logo.svg.zip', 'none'],
    ['text/html', 'page.html', 'none'],
    ['application/pdf', 'document.pdf', 'pdf'],
    ['image/png', 'image.png', 'png'],
    ['image/jpeg', 'image.jpg', 'jpeg'],
    ['audio/mpeg', 'recording.mp3', 'audio'],
    ['video/webm', 'recording.webm', 'video'],
    ['application/json', 'form.json', 'json'],
    ['message/rfc822', 'email.eml', 'mail'],
    ['application/octet-stream', 'email.msg', 'mail'],
  ])('recognizes %s / %s as %s', (mime, filename, expected) => {
    expect(getPreviewType(mime, filename)).toBe(expected)
  })
})
