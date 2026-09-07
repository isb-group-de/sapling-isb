<template>
  <div class="sapling-account-dialog__panel-stack">
    <SaplingSwitch
      :model-value="rotation"
      :label="$t('mail.signatureRotation')"
      hide-details
      :disabled="disabled"
      @update:model-value="$emit('update:rotation', Boolean($event))"
    />
    <SaplingAutocomplete
      v-if="!rotation"
      autocomplete="off"
      :model-value="signatureHandle"
      :items="signatures.filter((item) => item.isActive)"
      item-title="name"
      item-value="handle"
      :label="$t('mail.fixedSignature')"
      :hint="$t('mail.noSignatureHint')"
      persistent-hint
      :disabled="disabled"
      @update:model-value="$emit('update:signatureHandle', $event ?? null)"
    />
    <v-alert
      v-else-if="!signatures.some((item) => item.isActive && item.useInRotation)"
      type="info"
      variant="tonal"
      density="compact"
      >{{ $t('mail.noRotationSignatures') }}</v-alert
    >
  </div>
</template>

<script setup lang="ts">
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import type { EmailSignature } from '@/services/api.mail-signature.service'

defineProps<{
  rotation: boolean
  signatureHandle: number | null
  signatures: EmailSignature[]
  disabled?: boolean
}>()
defineEmits<{
  'update:rotation': [value: boolean]
  'update:signatureHandle': [value: number | null]
}>()
</script>
