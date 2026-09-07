import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { exportProfilePictureCrop, getProfilePictureCrop } from './profilePictureCrop'

export function useProfilePictureCrop(file: File) {
  const canvas = ref<HTMLCanvasElement | null>(null)
  const bitmap = shallowRef<ImageBitmap | null>(null)
  const loading = ref(true)
  const exporting = ref(false)
  const error = ref('')
  const zoom = ref(1)
  const centerX = ref(0)
  const centerY = ref(0)
  const dragging = ref(false)
  let disposed = false
  let pointer: { id: number; x: number; y: number } | null = null
  const crop = computed(() =>
    bitmap.value
      ? getProfilePictureCrop(
          bitmap.value.width,
          bitmap.value.height,
          zoom.value,
          centerX.value,
          centerY.value,
        )
      : null,
  )

  function draw() {
    if (!bitmap.value || !crop.value || !canvas.value) return
    const context = canvas.value.getContext('2d')
    if (!context) {
      error.value = 'account.profileCropFailed'
      return
    }
    const { x, y, size } = crop.value
    context.clearRect(0, 0, canvas.value.width, canvas.value.height)
    context.drawImage(bitmap.value, x, y, size, size, 0, 0, canvas.value.width, canvas.value.height)
  }

  function move(dx: number, dy: number) {
    if (!bitmap.value || !crop.value) return
    const next = getProfilePictureCrop(
      bitmap.value.width,
      bitmap.value.height,
      zoom.value,
      crop.value.x + crop.value.size / 2 + dx,
      crop.value.y + crop.value.size / 2 + dy,
    )
    centerX.value = next.x + next.size / 2
    centerY.value = next.y + next.size / 2
  }

  function reset() {
    zoom.value = 1
    centerX.value = (bitmap.value?.width ?? 0) / 2
    centerY.value = (bitmap.value?.height ?? 0) / 2
  }

  function pointerDown(event: PointerEvent) {
    if (!bitmap.value || exporting.value || event.button !== 0) return
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
    dragging.value = true
    canvas.value?.setPointerCapture(event.pointerId)
    canvas.value?.focus()
  }

  function pointerMove(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId || !crop.value || !canvas.value) return
    const scale = crop.value.size / canvas.value.getBoundingClientRect().width
    move((pointer.x - event.clientX) * scale, (pointer.y - event.clientY) * scale)
    pointer.x = event.clientX
    pointer.y = event.clientY
  }

  function pointerEnd(event: PointerEvent) {
    if (pointer?.id !== event.pointerId) return
    pointer = null
    dragging.value = false
    if (canvas.value?.hasPointerCapture(event.pointerId))
      canvas.value.releasePointerCapture(event.pointerId)
  }

  function keyDown(event: KeyboardEvent) {
    if (!crop.value || exporting.value) return
    const step = crop.value.size * (event.shiftKey ? 0.1 : 0.02)
    const movements: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const movement = movements[event.key]
    if (!movement) return
    event.preventDefault()
    move(...movement)
  }

  async function exportFile(): Promise<File | null> {
    if (!bitmap.value || !crop.value || exporting.value) return null
    exporting.value = true
    error.value = ''
    try {
      const result = await exportProfilePictureCrop(bitmap.value, crop.value, file.name)
      return disposed ? null : result
    } catch {
      if (!disposed) error.value = 'account.profileCropFailed'
      return null
    } finally {
      exporting.value = false
    }
  }

  onMounted(async () => {
    try {
      if (
        !file.size ||
        file.size > 5 * 1024 * 1024 ||
        (file.type
          ? !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
          : !/\.(jpe?g|png|webp|gif)$/i.test(file.name))
      ) {
        throw new Error('Unsupported image')
      }
      // Browser decoding respects EXIF orientation and freezes animated images to a still.
      const image = await createImageBitmap(file)
      if (disposed) {
        image.close()
        return
      }
      bitmap.value = image
      reset()
    } catch {
      if (!disposed) error.value = 'account.profileCropLoadFailed'
    } finally {
      if (!disposed) loading.value = false
    }
  })
  watch([crop, canvas], draw, { flush: 'post' })
  onBeforeUnmount(() => {
    disposed = true
    bitmap.value?.close()
  })

  return {
    canvas,
    loading,
    exporting,
    error,
    zoom,
    dragging,
    crop,
    reset,
    pointerDown,
    pointerMove,
    pointerEnd,
    keyDown,
    exportFile,
  }
}
