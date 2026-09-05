<template>
  <div v-if="selectedRole" class="sapling-admin-overview-row sapling-permission-overview-row">
    <section
      class="sapling-section-panel sapling-page-panel sapling-admin-selection sapling-permission-selection glass-panel"
    >
      <div>
        <p class="sapling-eyebrow sapling-admin-section-eyebrow sapling-permission-section-eyebrow">
          {{ $t('role.selectedRole') }}
        </p>
        <h2 class="sapling-section-title">{{ selectedRole.title }}</h2>
        <div
          class="sapling-chip-row sapling-admin-selection__meta sapling-permission-selection-meta"
        >
          <v-chip size="small" color="primary" variant="tonal">
            {{ getStageTitle(selectedRole.stage) }}
          </v-chip>
          <v-chip size="small" variant="outlined">
            {{ selectedRoleStats.memberCount }} {{ $t('role.persons') }}
          </v-chip>
          <v-chip size="small" variant="outlined">
            {{ selectedRoleStats.enabledPermissionCount }} {{ $t('right.enabled') }}
          </v-chip>
          <v-chip
            v-if="selectedRoleStats.dirtyEntityCount"
            size="small"
            color="warning"
            variant="tonal"
          >
            {{ selectedRoleStats.dirtyEntityCount }} {{ $t('permission.changedEntities') }}
          </v-chip>
        </div>
      </div>

      <div class="sapling-admin-selection__status sapling-permission-selection-status">
        <v-alert
          v-if="hasUnsavedPermissionChanges"
          type="warning"
          density="comfortable"
          variant="tonal"
        >
          {{ $t('permission.reviewStagedChanges') }}
        </v-alert>
      </div>
    </section>

    <section class="sapling-permission-summary" :aria-label="$t('permission.changeSummary')">
      <span
        >{{ $t('permission.visibleEntities') }}: <strong>{{ visibleEntityCount }}</strong></span
      >
      <span
        >{{ $t('permission.dirtyEntities') }}:
        <strong>{{ selectedRoleStats.dirtyEntityCount }}</strong></span
      >
      <span :title="$t('permission.summaryNote')"
        >{{ $t('permission.saveMode') }}: <strong>{{ $t('right.manual') }}</strong></span
      >
    </section>
  </div>
</template>

<script lang="ts" setup>
import type { RoleItem } from '@/entity/entity'

defineProps<{
  selectedRole: RoleItem | null
  selectedRoleStats: {
    memberCount: number
    enabledPermissionCount: number
    dirtyEntityCount: number
  }
  selectedGroup: string | null
  visibleEntityCount: number
  hasUnsavedPermissionChanges: boolean
  getStageTitle: (stage: RoleItem['stage']) => string
}>()
</script>
