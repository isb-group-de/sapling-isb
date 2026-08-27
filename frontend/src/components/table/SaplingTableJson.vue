<template>
  <div>
    <v-btn
      size="small"
      class="glass-panel"
      :rounded="false"
      :max-height="32"
      @click.stop="openJsonDialog()"
    >
      <v-icon class="pr-3" left>mdi-code-json</v-icon>
      {{ $t(`global.show`) }}
    </v-btn>
    <SaplingDialog
      v-model:modelValue="isDialogOpen"
      size="xxl"
      :height="SAPLING_DIALOG_HEIGHT.xl"
      persistent
      @keydown.esc.stop.prevent="closeJsonDialog"
    >
      <SaplingDialogCard
        class="sapling-dialog-json-card sapling-dialog-card--fill"
        :tilt="false"
        :close="closeJsonDialog"
      >
        <SaplingDialogShell fill-shell body-class="sapling-dialog-json-content">
          <template #hero>
            <SaplingDialogHero :title="$t(dialogTitleKey)" />
          </template>

          <template #body>
            <div class="sapling-dialog-json-body">
              <SaplingCodeMirror
                v-model="formattedJson"
                language="json"
                :theme="editorTheme"
                read-only
                class="sapling-dialog-json-editor"
              />
            </div>
          </template>

          <template #actions>
            <SaplingActionJson
              :cancel="closeJsonDialog"
              :download="downloadJson"
              cancel-label-key="global.close"
            />
          </template>
        </SaplingDialogShell>
      </SaplingDialogCard>
    </SaplingDialog>
  </div>
</template>

<script lang="ts" setup>
import SaplingCodeMirror from '@/components/common/SaplingCodeMirror.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingActionJson from '@/components/actions/SaplingActionJson.vue'
import {
  useSaplingTableJson,
  type UseSaplingTableJsonProps,
} from '@/composables/table/useSaplingTableJson'
import { downloadTextFile } from '@/composables/table/saplingTableAction.utils'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import { createJsonDownloadFilename } from '@/utils/jsonDownload'

const props = defineProps<UseSaplingTableJsonProps>()

const {
  isDialogOpen,
  openJsonDialog,
  closeJsonDialog,
  formattedJson,
  dialogTitleKey,
  editorTheme,
} = useSaplingTableJson(props)

function downloadJson() {
  downloadTextFile(
    formattedJson.value,
    createJsonDownloadFilename(`${props.entityHandle}-${props.template.name}`, 'data'),
    'application/json;charset=utf-8',
  )
}
</script>
