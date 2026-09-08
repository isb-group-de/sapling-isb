import { describe, expect, it } from 'vitest'
import { getImagePreviewMimeType, getPreviewType } from '../documentPreview'

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
    ['image/gif', 'animation.gif', 'image'],
    [' IMAGE/WEBP; charset=utf-8 ', 'photo', 'image'],
    ['image/avif', 'photo.avif', 'image'],
    ['', 'Screenshot.PNG', 'image'],
    ['application/octet-stream', 'photo.JPEG', 'image'],
    ['application/octet-stream', 'animation.GIF', 'image'],
    ['image/tiff', 'scan.tiff', 'image'],
    ['audio/mpeg', 'recording.mp3', 'audio'],
    ['video/webm', 'recording.webm', 'video'],
    ['application/json', 'form.json', 'json'],
    ['message/rfc822', 'email.eml', 'mail'],
    ['application/octet-stream', 'email.msg', 'mail'],
  ])('recognizes %s / %s as %s', (mime, filename, expected) => {
    expect(getPreviewType(mime, filename)).toBe(expected)
  })

  it.each([
    [' IMAGE/WEBP; charset=utf-8 ', 'photo.png', 'image/webp'],
    ['image/x-icon', 'favicon', 'image/vnd.microsoft.icon'],
    ['image/jpg', 'photo', 'image/jpeg'],
    ['application/octet-stream', 'Screenshot.PNG', 'image/png'],
    ['', 'photo.AVIF', 'image/avif'],
    ['text/xml', 'logo.svg', 'image/svg+xml'],
    ['text/html', 'page.html', ''],
  ])('normalizes %s / %s to %s', (mime, filename, expected) => {
    expect(getImagePreviewMimeType(mime, filename)).toBe(expected)
  })
})
