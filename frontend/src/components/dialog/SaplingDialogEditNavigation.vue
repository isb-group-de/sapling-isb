<template>
  <nav class="sapling-record-dialog-nav sapling-dialog-edit-nav" :aria-label="entityLabel">
    <button
      class="sapling-record-dialog-nav-item sapling-dialog-edit-nav-item"
      :class="{
        'sapling-record-dialog-nav-item--active': activeTab === 0,
        'sapling-record-dialog-nav-item--record': true,
      }"
      type="button"
      :aria-current="activeTab === 0 ? 'page' : undefined"
      @click="activeTab = 0"
    >
      <v-icon class="sapling-record-dialog-nav-item__icon" size="18">
        mdi-file-document-edit-outline
      </v-icon>
      <span class="sapling-record-dialog-nav-item__label">{{ entityLabel }}</span>
    </button>
    <template v-if="mode !== 'create'">
      <button
        v-for="(template, idx) in relationTemplates"
        :key="template.name"
        class="sapling-record-dialog-nav-item sapling-dialog-edit-nav-item"
        :class="{
          'sapling-record-dialog-nav-item--active': activeTab === idx + 1,
        }"
        type="button"
        :aria-current="activeTab === idx + 1 ? 'page' : undefined"
        @click="activeTab = idx + 1"
      >
        <v-icon class="sapling-record-dialog-nav-item__icon" size="18"> mdi-link-variant </v-icon>
        <span class="sapling-record-dialog-nav-item__label">
          {{ $t(`${entityHandle}.${template.name}`) }}
        </span>
      </button>
    </template>
  </nav>
</template>

<script lang="ts" setup>
import type { DialogState, EntityTemplate } from '@/entity/structure'

defineProps<{
  entityHandle: string
  entityLabel: string
  mode: DialogState
  relationTemplates: EntityTemplate[]
}>()

const activeTab = defineModel<number>('activeTab', { required: true })
</script>
