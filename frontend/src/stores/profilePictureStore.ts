import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useCurrentPersonStore } from './currentPersonStore'
import ApiProfilePictureService from '@/services/api.profile-picture.service'
import type { ReferencedImageDocument } from '@/services/api.document.service'

export const useProfilePictureStore = defineStore('profilePictures', () => {
  const currentPerson = useCurrentPersonStore()
  const pictures = ref<ReferencedImageDocument[]>([])
  const activeIndex = ref(0)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref('')
  const paused = ref(false)
  const failedUploads = ref<string[]>([])
  const imageFailed = ref(false)
  const imageLoading = ref(false)
  const imageRevision = ref(0)
  const imageUrls = ref<Record<number, string>>({})
  const cachedHandles: number[] = []
  const activePicture = computed(() => pictures.value[activeIndex.value] ?? null)
  const activeUrl = computed(() =>
    activePicture.value ? (imageUrls.value[activePicture.value.handle] ?? '') : '',
  )
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const reducedMotion = ref(motion?.matches ?? false)
  let generation = 0
  let request = 0
  let timer: ReturnType<typeof setInterval> | undefined

  function releaseImage(handle: number) {
    const url = imageUrls.value[handle]
    if (url) URL.revokeObjectURL(url)
    delete imageUrls.value[handle]
    const index = cachedHandles.indexOf(handle)
    if (index >= 0) cachedHandles.splice(index, 1)
  }

  function clearImages() {
    for (const handle of [...cachedHandles]) releaseImage(handle)
    imageFailed.value = false
  }

  // Share protected image blobs across every avatar and bound memory to eight files.
  watch(
    [() => activePicture.value?.handle, imageRevision],
    async ([handle], _previous, onCleanup) => {
      imageFailed.value = false
      imageLoading.value = false
      if (!handle || imageUrls.value[handle]) return
      imageLoading.value = true
      const controller = new AbortController()
      const ownGeneration = generation
      let stale = false
      onCleanup(() => {
        stale = true
        controller.abort()
      })
      try {
        const blob = await ApiProfilePictureService.getImage(handle, controller.signal)
        if (stale || ownGeneration !== generation || activePicture.value?.handle !== handle) return
        imageUrls.value[handle] = URL.createObjectURL(blob)
        cachedHandles.push(handle)
        while (cachedHandles.length > 8) releaseImage(cachedHandles[0]!)
      } catch {
        if (!stale && ownGeneration === generation) imageFailed.value = true
      } finally {
        if (!stale && ownGeneration === generation) imageLoading.value = false
      }
    },
  )

  async function refresh() {
    if (!currentPerson.person?.handle) return
    const ownRequest = ++request
    loading.value = true
    error.value = ''
    try {
      const result = await ApiProfilePictureService.list()
      if (ownRequest !== request) return
      const activeHandle = activePicture.value?.handle
      pictures.value = result
      for (const handle of [...cachedHandles]) {
        if (!result.some((picture) => picture.handle === handle)) releaseImage(handle)
      }
      activeIndex.value = Math.max(
        0,
        result.findIndex((picture) => picture.handle === activeHandle),
      )
      imageRevision.value++
    } catch {
      if (ownRequest === request) error.value = 'account.profilePicturesLoadFailed'
    } finally {
      if (ownRequest === request) loading.value = false
    }
  }

  function select(index: number) {
    if (!pictures.value.length) return
    activeIndex.value = (index + pictures.value.length) % pictures.value.length
  }

  async function upload(files: File[]) {
    if (busy.value || currentPerson.isImpersonating || !currentPerson.person) return
    busy.value = true
    error.value = ''
    failedUploads.value = []
    const ownGeneration = generation
    try {
      for (const file of files) {
        if (ownGeneration !== generation) break
        try {
          if (
            !file.size ||
            file.size > 5 * 1024 * 1024 ||
            !(
              /\.(png|jpe?g|webp|gif)$/i.test(file.name) ||
              ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
            )
          ) {
            throw new Error('invalid image')
          }
          const picture = await ApiProfilePictureService.upload(file)
          if (ownGeneration !== generation) break
          pictures.value = [
            picture,
            ...pictures.value.filter((item) => item.handle !== picture.handle),
          ]
          activeIndex.value = 0
        } catch {
          if (ownGeneration === generation) failedUploads.value.push(file.name)
        }
      }
      if (ownGeneration === generation && failedUploads.value.length) {
        error.value = 'account.profilePicturesUploadFailed'
      }
    } finally {
      if (ownGeneration === generation) busy.value = false
    }
  }

  async function remove(handle: number) {
    if (busy.value || currentPerson.isImpersonating || !currentPerson.person) return
    busy.value = true
    error.value = ''
    const ownGeneration = generation
    try {
      await ApiProfilePictureService.remove(handle)
      if (ownGeneration !== generation) return
      pictures.value = pictures.value.filter((picture) => picture.handle !== handle)
      releaseImage(handle)
      activeIndex.value = Math.min(activeIndex.value, Math.max(0, pictures.value.length - 1))
    } catch {
      if (ownGeneration === generation) error.value = 'account.profilePicturesDeleteFailed'
    } finally {
      if (ownGeneration === generation) busy.value = false
    }
  }

  function updateMotion() {
    reducedMotion.value = motion?.matches ?? false
  }
  motion?.addEventListener('change', updateMotion)

  watch([() => pictures.value.length, paused, reducedMotion], ([count, stopped, reduced]) => {
    clearInterval(timer)
    timer = undefined
    if (count > 1 && !stopped && !reduced) {
      timer = setInterval(() => {
        if (!document.hidden && !busy.value && !imageLoading.value) select(activeIndex.value + 1)
      }, 60_000)
    }
  })

  watch(
    () => currentPerson.person?.handle,
    () => {
      generation++
      request++
      pictures.value = []
      clearImages()
      activeIndex.value = 0
      busy.value = false
      loading.value = false
      error.value = ''
      failedUploads.value = []
      void refresh()
    },
    { immediate: true, flush: 'sync' },
  )

  onScopeDispose(() => {
    generation++
    request++
    clearInterval(timer)
    clearImages()
    motion?.removeEventListener('change', updateMotion)
  })

  return {
    pictures,
    activeIndex,
    activePicture,
    activeUrl,
    loading,
    busy,
    error,
    paused,
    reducedMotion,
    failedUploads,
    imageFailed,
    refresh,
    upload,
    remove,
    select,
  }
})
