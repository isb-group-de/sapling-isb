<template>
  <section class="sapling-account-dialog__panel-stack sapling-account-dialog__profile-edit">
    <div class="sapling-account-dialog__section-heading">
      <v-icon color="primary">mdi-account-box-multiple-outline</v-icon>
      <span>{{ $t('account.profilePictures') }}</span>
    </div>
    <p class="text-body-2 text-medium-emphasis">{{ $t('account.profilePicturesHint') }}</p>
    <v-alert v-if="pictures.error" type="error" variant="tonal" role="alert">
      {{ $t(pictures.error) }}
      <span v-if="pictures.failedUploads.length">{{ pictures.failedUploads.join(', ') }}</span>
      <v-btn variant="text" :disabled="pictures.busy" @click="pictures.refresh()">
        {{ $t('account.profilePicturesReload') }}
      </v-btn>
    </v-alert>
    <v-progress-linear
      v-if="pictures.loading"
      indeterminate
      :aria-label="$t('account.profilePictures')"
    />
    <div class="sapling-profile-pictures__preview">
      <SaplingProfileAvatar :name="name" :initials="initials" large />
      <div class="sapling-profile-pictures__controls">
        <p v-if="pictures.imageFailed" role="status">
          {{ $t('account.profilePictureUnavailable') }}
        </p>
        <p v-if="!pictures.pictures.length">{{ $t('account.profilePicturesEmpty') }}</p>
        <template v-else>
          <p>{{ pictures.activePicture?.filename }}</p>
          <div v-if="pictures.pictures.length > 1" class="sapling-profile-pictures__actions">
            <v-btn
              icon="mdi-chevron-left"
              variant="text"
              :aria-label="$t('account.profilePicturePrevious')"
              @click="select(pictures.activeIndex - 1)"
            />
            <span>{{ pictures.activeIndex + 1 }} / {{ pictures.pictures.length }}</span>
            <v-btn
              icon="mdi-chevron-right"
              variant="text"
              :aria-label="$t('account.profilePictureNext')"
              @click="select(pictures.activeIndex + 1)"
            />
            <v-btn
              v-if="!pictures.reducedMotion"
              :icon="pictures.paused ? 'mdi-play' : 'mdi-pause'"
              variant="text"
              :aria-label="
                $t(pictures.paused ? 'account.profilePicturesPlay' : 'account.profilePicturesPause')
              "
              @click="pictures.paused = !pictures.paused"
            />
          </div>
        </template>
        <div class="sapling-profile-pictures__actions">
          <input
            ref="fileInput"
            class="d-none"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            @change="upload"
          />
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-camera-plus-outline"
            :loading="pictures.busy"
            :disabled="currentPerson.isImpersonating || pictures.loading"
            @click="fileInput?.click()"
          >
            {{ $t('account.profilePicturesUpload') }}
          </v-btn>
          <v-btn
            v-if="pictures.activePicture"
            color="error"
            variant="text"
            prepend-icon="mdi-delete-outline"
            :disabled="pictures.busy || currentPerson.isImpersonating || pictures.loading"
            @click="askRemove"
          >
            {{ $t('account.profilePictureRemove') }}
          </v-btn>
        </div>
        <div v-if="pendingRemoval" class="sapling-profile-pictures__confirmation" role="alert">
          <p>
            {{ $t('account.profilePictureRemoveConfirm', { filename: pendingRemoval.filename }) }}
          </p>
          <v-btn
            color="error"
            variant="tonal"
            :disabled="pictures.busy || currentPerson.isImpersonating"
            @click="confirmRemove"
            >{{ $t('global.delete') }}</v-btn
          >
          <v-btn variant="text" :disabled="pictures.busy" @click="pendingRemoval = null">{{
            $t('global.cancel')
          }}</v-btn>
        </div>
      </div>
    </div>
  </section>
  <SaplingProfilePictureCropDialog
    v-if="cropFile"
    :key="cropPosition"
    :file="cropFile"
    :position="cropPosition + 1"
    :total="cropFiles.length"
    :busy="pictures.busy"
    :disabled="currentPerson.isImpersonating"
    :upload-error="pictures.error"
    @cancel="cropFiles = []"
    @skip="nextCrop"
    @save="saveCrop"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SaplingProfilePictureCropDialog from './SaplingProfilePictureCropDialog.vue'
import SaplingProfileAvatar from './SaplingProfileAvatar.vue'
import { useProfilePictureStore } from '@/stores/profilePictureStore'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import type { ReferencedImageDocument } from '@/services/api.document.service'

const pictures = useProfilePictureStore()
const currentPerson = useCurrentPersonStore()
const fileInput = ref<HTMLInputElement | null>(null)
const pendingRemoval = ref<ReferencedImageDocument | null>(null)
const cropFiles = ref<File[]>([])
const cropPosition = ref(0)
const cropFile = computed(() => cropFiles.value[cropPosition.value])
watch(
  () => currentPerson.person?.handle,
  () => {
    cropFiles.value = []
  },
)
const name = computed(() =>
  [currentPerson.person?.firstName, currentPerson.person?.lastName].filter(Boolean).join(' '),
)
const initials = computed(() =>
  [currentPerson.person?.firstName, currentPerson.person?.lastName]
    .map((part) => part?.charAt(0) ?? '')
    .join('')
    .toUpperCase(),
)

onMounted(() => {
  if (!pictures.loading) void pictures.refresh()
})

function select(index: number) {
  pictures.paused = true
  pictures.select(index)
}

function askRemove() {
  pictures.paused = true
  pendingRemoval.value = pictures.activePicture
}

async function confirmRemove() {
  if (!pendingRemoval.value) return
  await pictures.remove(pendingRemoval.value.handle)
  pendingRemoval.value = null
}

function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  pendingRemoval.value = null
  pictures.error = ''
  pictures.failedUploads = []
  cropPosition.value = 0
  cropFiles.value = files
}

function nextCrop() {
  pictures.error = ''
  pictures.failedUploads = []
  cropPosition.value++
  if (cropPosition.value >= cropFiles.value.length) cropFiles.value = []
}

async function saveCrop(file: File) {
  if (pictures.busy || currentPerson.isImpersonating) return
  const original = cropFile.value
  await pictures.upload([file])
  if (original === cropFile.value && !pictures.error) nextCrop()
}
</script>
