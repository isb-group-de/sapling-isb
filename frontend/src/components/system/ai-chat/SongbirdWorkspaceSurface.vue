<template>
  <div class="songbird-workspace">
    <v-alert v-if="c.widgetConfigurationError" type="error" density="compact">{{
      $t('aiChat.widgetConfigurationError')
    }}</v-alert>
    <SaplingAiChatLoadingState v-if="c.isTranslationLoading" />
    <SaplingAiChatConversation
      :workspace-instruction="
        c.activeSession ? c.activeSession.workspaceInstruction : c.frozenWidget?.config.instruction
      "
      :active-conversation-title="c.activeConversationTitle"
      :active-runtime-summary="c.activeRuntimeSummary"
      :agent-options="c.agentOptions"
      :selected-agent-config="c.selectedAgentConfig"
      :selected-agent-handle="c.selectedAgentHandle"
      :playbook-options="c.playbookOptions"
      :selected-playbook-handle="c.selectedPlaybookHandle"
      :is-agent-locked="!!c.activeSession?.handle || !!c.frozenWidget"
      :has-configured-providers="c.hasConfiguredProviders"
      :is-loading-runtime-catalog="c.isLoadingChatRuntimeCatalog"
      :has-loaded-runtime-catalog="c.hasLoadedRuntimeCatalog"
      :runtime-catalog-load-failed="c.hasRuntimeCatalogLoadError"
      :has-configured-transcription-providers="c.hasConfiguredTranscriptionProviders"
      :can-send-message="c.canSendMessage"
      :is-sending="c.isResponseActive"
      :queued-inputs="c.queuedInputs"
      :messages="c.messages"
      :draft-message="c.draftMessage"
      :assistant-name="c.assistantName"
      :current-person-display-name="c.currentPersonDisplayName"
      :streaming-duration-by-handle="c.streamingDurationByHandle"
      :has-more-messages="c.hasMoreMessages"
      :is-loading-older-messages="c.isLoadingOlderMessages"
      :is-voice-input-available="c.isVoiceInputAvailable"
      :is-voice-output-available="c.isVoiceOutputAvailable"
      :is-recording-voice-input="c.isRecordingVoiceInput"
      :is-transcribing-voice-input="c.isTranscribingVoiceInput"
      :can-upload-import-attachment="c.canUploadImportAttachment"
      :can-upload-image="c.canUploadImage"
      :is-uploading-import-attachment="c.isUploadingImportAttachment"
      :pending-attachments="c.pendingAttachments"
      :active-tool-action-handles="c.activeToolActionHandles"
      :speech-state-by-handle="c.speechStateByHandle"
      :rating-state-by-handle="c.ratingStateByHandle"
      :title-preview-limit="c.TITLE_PREVIEW_LIMIT"
      @update:draft-message="c.updateDraftMessage"
      @update:selected-agent="c.updateSelectedAgent"
      @update:selected-playbook="c.updateSelectedPlaybook"
      @close="returnToWork"
      @load-older-messages="c.loadOlderMessages"
      @toggle-message-speech="c.toggleMessageSpeech"
      @confirm-tool-action="c.confirmToolAction"
      @reject-tool-action="c.rejectToolAction"
      @update-message-rating="c.updateMessageRating"
      @toggle-voice-input="c.toggleVoiceInput"
      @upload-import-attachment="c.uploadImportAttachment"
      @upload-images="c.uploadImageAttachments"
      @remove-import-attachment="c.removeImportAttachment"
      @send="c.sendMessage"
      @steer="c.steerMessage"
      @cancel-queued-input="c.cancelQueuedInput"
      @retry-runtime-catalog="c.loadRuntimeCatalogs"
    />
  </div>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useSongbirdDock } from '@/composables/system/useSongbirdDock'
import type { SongbirdWorkspaceState } from './useSongbirdWorkspace'
import SaplingAiChatConversation from './SaplingAiChatConversation.vue'
import SaplingAiChatLoadingState from './SaplingAiChatLoadingState.vue'
const props = defineProps<{ c: SongbirdWorkspaceState }>()
const { fullscreen } = useSongbirdDock()
function returnToWork() {
  if (fullscreen.value) props.c.closePanel()
}
onMounted(() => props.c.mountSurface())
onUnmounted(() => props.c.unmountSurface())
</script>
