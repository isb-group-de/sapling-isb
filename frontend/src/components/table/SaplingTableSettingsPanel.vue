<template>
  <v-list class="glass-panel sapling-table-settings" density="compact" nav>
    <v-list-item
      v-if="showBack"
      prepend-icon="mdi-arrow-left"
      :title="$t('global.back')"
      @click="emit('back')"
    />
    <v-list-subheader>{{ $t('global.tableSettings') }}</v-list-subheader>
    <v-list-item
      v-if="allowGrouping"
      prepend-icon="mdi-format-list-group"
      :title="$t('global.tableShowGrouping')"
      :active="preferences.showGrouping"
      @click="preferences = { ...preferences, showGrouping: !preferences.showGrouping }"
    >
      <template #append
        ><v-icon>{{
          preferences.showGrouping ? 'mdi-checkbox-marked-outline' : 'mdi-checkbox-blank-outline'
        }}</v-icon></template
      >
    </v-list-item>
    <v-divider v-if="allowGrouping && deadlineFields.length" />
    <v-list-item
      v-if="deadlineFields.length"
      :subtitle="$t('global.tableDeadlineHint')"
      class="sapling-table-settings__hint"
    />
    <v-list-group v-for="field in deadlineFields" :key="field.name" :value="field.name">
      <template #activator="{ props: fieldProps }">
        <v-list-item
          v-bind="fieldProps"
          prepend-icon="mdi-calendar-clock-outline"
          :title="$t(`${entityHandle}.${field.name}`)"
          :subtitle="
            $t(
              preferences.rowDeadlineFields.includes(field.name)
                ? 'global.tableDeadlineRow'
                : 'global.tableDeadlineField',
            )
          "
        />
      </template>
      <v-list-item
        v-for="mode in deadlineModes"
        :key="mode.value"
        :title="mode.title"
        :active="
          (preferences.rowDeadlineFields.includes(field.name) ? 'row' : 'field') === mode.value
        "
        @click="setDeadlineMode(field.name, mode.value)"
      >
        <template #append
          ><v-icon
            v-if="
              (preferences.rowDeadlineFields.includes(field.name) ? 'row' : 'field') === mode.value
            "
            >mdi-check</v-icon
          ></template
        >
      </v-list-item>
    </v-list-group>
  </v-list>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplate } from '@/entity/structure'
import {
  isDeadlineTemplate,
  useTablePreferences,
} from '@/composables/table/saplingTablePreferences'

const props = defineProps<{
  entityHandle: string
  entityTemplates: EntityTemplate[]
  allowGrouping: boolean
  showBack?: boolean
}>()
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
const preferences = useTablePreferences(toRef(props, 'entityHandle'))
const deadlineFields = computed(() => props.entityTemplates.filter(isDeadlineTemplate))
const deadlineModes = computed(() => [
  { title: t('global.tableDeadlineField'), value: 'field' },
  { title: t('global.tableDeadlineRow'), value: 'row' },
])
function setDeadlineMode(field: string, mode: string) {
  const fields = preferences.value.rowDeadlineFields.filter((name) => name !== field)
  preferences.value = {
    ...preferences.value,
    rowDeadlineFields: mode === 'row' ? [...fields, field] : fields,
  }
}
</script>
