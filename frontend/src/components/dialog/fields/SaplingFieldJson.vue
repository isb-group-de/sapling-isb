<template>
  <div>
    <div class="pt-1">
      <v-btn class="glass-panel" @click.stop="openDialog" block>
        <v-icon class="pr-3" left>mdi-code-json</v-icon>
        {{ label }}
      </v-btn>
    </div>

    <v-dialog
      v-model="dialog"
      :max-width="SAPLING_DIALOG_MAX_WIDTH.xxl"
      :height="SAPLING_DIALOG_HEIGHT.xl"
      persistent
      @keydown.esc.stop.prevent="closeDialog"
    >
      <SaplingDialogCard
        class="sapling-dialog-json-card sapling-dialog-card--fill"
        :tilt="false"
        :close="closeDialog"
      >
        <SaplingDialogShell fill-shell body-class="sapling-dialog-json-content">
          <template #hero>
            <v-card-title class="sapling-dialog-json-title">
              <span>{{ label }}</span>
              <v-spacer />
              <v-btn
                variant="text"
                size="small"
                density="comfortable"
                icon="mdi-close"
                :aria-label="$t('global.close')"
                :title="$t('global.close')"
                @click="closeDialog"
              />
            </v-card-title>
          </template>

          <template #body>
            <div class="sapling-dialog-json-body">
              <SaplingCodeMirror
                v-model="jsonString"
                language="json"
                theme="dark"
                :read-only="disabled"
                class="sapling-dialog-json-editor"
              />
              <v-alert v-if="error" type="error" density="comfortable">{{ error }}</v-alert>
            </div>
          </template>

          <template #actions>
            <SaplingActionJson :cancel="closeDialog" :download="downloadJson" :confirm="saveJson" />
          </template>
        </SaplingDialogShell>
      </SaplingDialogCard>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import SaplingActionJson from '@/components/actions/SaplingActionJson.vue'
import SaplingCodeMirror from '@/components/common/SaplingCodeMirror.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import { downloadTextFile } from '@/composables/table/saplingTableAction.utils'
import { SAPLING_DIALOG_MAX_WIDTH, SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import { createJsonDownloadFilename } from '@/utils/jsonDownload'

const props = defineProps<{
  modelValue: unknown
  label: string
  disabled?: boolean
}>()
const emit = defineEmits(['update:modelValue'])

const dialog = ref(false)
const error = ref('')

const jsonString = ref('')

function formatJsonValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'null'
  }

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return JSON.stringify(value, null, 2)
    }
  }

  return JSON.stringify(value, null, 2)
}

watch(
  () => props.modelValue,
  (val) => {
    try {
      jsonString.value = formatJsonValue(val)
      error.value = ''
    } catch {
      jsonString.value = 'null'
      error.value = 'Invalid JSON'
    }
  },
  { immediate: true },
)

function openDialog() {
  dialog.value = true
  try {
    jsonString.value = formatJsonValue(props.modelValue)
    error.value = ''
  } catch {
    jsonString.value = 'null'
    error.value = 'Invalid JSON'
  }
}
function closeDialog() {
  dialog.value = false
  error.value = ''
}
function downloadJson() {
  downloadTextFile(
    jsonString.value,
    createJsonDownloadFilename(props.label, 'payload'),
    'application/json;charset=utf-8',
  )
}
function saveJson() {
  try {
    const parsed = JSON.parse(jsonString.value)
    emit('update:modelValue', parsed)
    dialog.value = false
    error.value = ''
  } catch {
    error.value = 'JSON Parse Error'
  }
}
</script>
