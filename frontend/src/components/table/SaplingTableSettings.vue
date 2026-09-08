<template>
  <v-menu location="bottom end" :close-on-content-click="false">
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        class="sapling-table-toolbar-action sapling-table-toolbar-action--icon-only sapling-table-toolbar-action--utility"
        icon="mdi-cog-outline"
        variant="tonal"
        color="primary"
        :title="$t('global.tableSettings')"
        :aria-label="$t('global.tableSettings')"
      />
    </template>
    <SaplingTableSettingsPanel
      :entity-handle="entityHandle"
      :entity-templates="entityTemplates"
      :allow-grouping="allowGrouping"
    />
  </v-menu>
</template>
<script setup lang="ts">
import type { EntityTemplate } from '@/entity/structure'
import SaplingTableSettingsPanel from './SaplingTableSettingsPanel.vue'
defineProps<{ entityHandle: string; entityTemplates: EntityTemplate[]; allowGrouping: boolean }>()
</script>
