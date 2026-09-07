export interface ProfilePictureCrop {
  x: number
  y: number
  size: number
}

/** Source-image coordinates for a square crop, always contained within the image. */
export function getProfilePictureCrop(
  width: number,
  height: number,
  zoom: number,
  centerX: number,
  centerY: number,
): ProfilePictureCrop {
  const size = Math.min(width, height) / Math.max(1, Math.min(4, zoom))
  return {
    x: Math.max(0, Math.min(width - size, centerX - size / 2)),
    y: Math.max(0, Math.min(height - size, centerY - size / 2)),
    size,
  }
}

export async function exportProfilePictureCrop(
  source: ImageBitmap,
  crop: ProfilePictureCrop,
  filename: string,
): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.max(1, Math.min(1024, Math.floor(crop.size)))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(source, crop.x, crop.y, crop.size, crop.size, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image export failed'))),
      'image/png',
    )
  })
  return new File([blob], `${filename.replace(/\.[^.]+$/, '') || 'profile'}.png`, {
    type: 'image/png',
  })
}
