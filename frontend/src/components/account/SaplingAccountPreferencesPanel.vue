<template>
  <section class="sapling-account-dialog__panel-stack">
    <div class="sapling-account-dialog__section-heading">
      <v-icon color="primary">mdi-translate</v-icon>
      <span>{{ $t('navigation.language') }}</span>
    </div>
    <v-btn-toggle
      divided
      mandatory
      :model-value="currentLanguage"
      variant="outlined"
      class="sapling-segmented-toggle sapling-account-dialog__language-toggle"
    >
      <v-btn
        v-for="language in languageOptions"
        :key="language.key"
        :value="language.key"
        @click="$emit('select-language', language.key)"
      >
        {{ language.label }}
      </v-btn>
    </v-btn-toggle>

    <v-divider />

    <div class="sapling-account-dialog__preference-grid">
      <button
        v-for="action in appearanceActions"
        :key="action.key"
        type="button"
        class="sapling-account-dialog__preference-action"
        :class="{ 'sapling-account-dialog__preference-action--active': action.isActive }"
        @click="action.handler()"
      >
        <span class="sapling-account-dialog__preference-icon">
          <v-icon :icon="action.icon" />
        </span>
        <span class="sapling-account-dialog__preference-label">{{ action.label }}</span>
        <v-icon :icon="action.isActive ? 'mdi-check-circle' : 'mdi-chevron-right'" size="18" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  SaplingLanguage,
  SaplingPreferenceAction,
} from '@/composables/system/useSaplingPreferences'

interface LanguageOption {
  key: SaplingLanguage
  label: string
}

defineProps<{
  currentLanguage: SaplingLanguage
  languageOptions: LanguageOption[]
  appearanceActions: SaplingPreferenceAction[]
}>()
defineEmits<{ 'select-language': [language: SaplingLanguage] }>()
</script>
