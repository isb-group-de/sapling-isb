<template>
  <SaplingKpiCard
    v-if="widget.kind === 'KPI' && kpi"
    :kpi="{ ...kpi, name: widget.title }"
    :kpi-idx="0"
    :tilt="!editing"
    :on-delete="editing ? () => emit('remove') : undefined"
  >
    <template #actions
      ><v-btn
        v-if="editing"
        variant="text"
        class="sapling-kpi-card__action sapling-kpi-card__action--edit"
        :title="$t('dashboard.editWidget')"
        @click.stop="emit('edit')"
        ><v-icon size="small">mdi-pencil-outline</v-icon></v-btn
      ></template
    >
  </SaplingKpiCard>
  <SaplingSurface
    v-else
    class="sapling-kpi-card"
    :class="{
      'sapling-widget-card--embedded': widget.kind === 'TABLE' || widget.kind === 'WEBSITE',
      'sapling-nested-backdrop-host': widget.kind === 'TABLE',
    }"
  >
    <div class="sapling-section-header sapling-kpi-card__header">
      <div class="sapling-kpi-card__headline">
        <div class="sapling-chip-row sapling-kpi-card__meta-row">
          <v-chip size="small" color="primary" variant="tonal">{{
            $t(`dashboard.widget${widget.kind}`)
          }}</v-chip>
        </div>
        <h3 class="sapling-kpi-card__title" :title="widget.title">{{ widget.title }}</h3>
      </div>
      <div class="sapling-kpi-card__header-tools">
        <v-btn-group density="compact" class="sapling-kpi-card__actions">
          <v-btn
            v-if="editing || widget.kind === 'NOTE'"
            variant="text"
            class="sapling-kpi-card__action sapling-kpi-card__action--edit"
            :title="$t('dashboard.editWidget')"
            @click.stop="emit('edit')"
            ><v-icon size="small">mdi-pencil-outline</v-icon></v-btn
          >
          <v-btn
            v-if="openUrl"
            :href="openUrl"
            :target="widget.kind === 'WEBSITE' ? '_blank' : undefined"
            :rel="widget.kind === 'WEBSITE' ? 'noopener noreferrer' : undefined"
            variant="text"
            class="sapling-kpi-card__action"
            :title="$t('dashboard.widgetOpen')"
            ><v-icon size="small">mdi-open-in-new</v-icon></v-btn
          >
          <v-btn
            v-if="
              ['KPI', 'AGENDA', 'TABLE'].includes(widget.kind) ||
              (widget.kind === 'WEBSITE' && widget.config.mode === 'embed')
            "
            variant="text"
            class="sapling-kpi-card__action"
            :title="$t('global.refresh')"
            @click.stop="refresh"
            ><v-icon size="small">mdi-refresh</v-icon></v-btn
          >
          <v-btn
            v-if="editing"
            variant="text"
            class="sapling-kpi-card__action sapling-kpi-card__action--delete"
            :title="$t('dashboard.removeWidget')"
            @click.stop="emit('remove')"
            ><v-icon size="small">mdi-delete</v-icon></v-btn
          >
        </v-btn-group>
      </div>
    </div>
    <div class="sapling-kpi-card__body">
      <v-skeleton-loader v-if="widget.kind === 'KPI' && loading" type="article" />
      <div v-else-if="widget.kind === 'KPI'" class="sapling-kpi-widget__state">
        {{ $t('dashboard.widgetUnavailable') }}
      </div>
      <SaplingAgendaWidget v-else-if="widget.kind === 'AGENDA'" ref="content" :widget="widget" />
      <SaplingTableWidget v-else-if="widget.kind === 'TABLE'" ref="content" :widget="widget" />
      <SaplingMarkdownContent
        v-else-if="widget.kind === 'NOTE' && widget.config.markdown"
        class="sapling-widget-note"
        :source="widget.config.markdown"
      />
      <div v-else-if="widget.kind === 'NOTE'" class="sapling-kpi-widget__state">
        {{ $t('dashboard.widgetNoteEmpty') }}
      </div>
      <SaplingQuickActionsWidget
        v-else-if="widget.kind === 'ACTIONS'"
        :widget="widget"
        :editing="editing"
      />
      <template v-else-if="widget.kind === 'WEBSITE' && validUrl">
        <iframe
          v-if="widget.config.mode === 'embed'"
          :key="frameKey"
          :src="widget.config.url"
          :title="widget.title"
          class="sapling-widget-frame"
          loading="lazy"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
        <div v-else class="sapling-widget-link">
          <v-icon size="48" color="primary">mdi-link-variant</v-icon>
          <v-btn
            :href="widget.config.url"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            variant="tonal"
            append-icon="mdi-open-in-new"
            >{{ $t('dashboard.widgetOpen') }}</v-btn
          >
          <span class="text-caption">{{ websiteHost }}</span>
        </div>
      </template>
    </div>
  </SaplingSurface>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import type { KPIItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import { isDashboardWebsiteUrl } from '@/composables/dashboard/saplingDashboardWidgets'
import SaplingSurface from '@/components/common/SaplingSurface.vue'
import SaplingKpiCard from '@/components/kpi/SaplingKpiCard.vue'
import SaplingAgendaWidget from './SaplingAgendaWidget.vue'
import SaplingTableWidget from './SaplingTableWidget.vue'
import SaplingMarkdownContent from '@/components/common/SaplingMarkdownContent.vue'
import SaplingQuickActionsWidget from './SaplingQuickActionsWidget.vue'
const props = defineProps<{ widget: DashboardWidget; editing: boolean }>()
const emit = defineEmits<{ (event: 'edit'): void; (event: 'remove'): void }>()
const kpi = ref<KPIItem | null>(null)
const loading = ref(false)
const content = ref<{ refresh: () => unknown } | null>(null)
const frameKey = ref(0)
const validUrl = computed(
  () => props.widget.kind === 'WEBSITE' && isDashboardWebsiteUrl(props.widget.config.url),
)
const websiteHost = computed(() =>
  validUrl.value && props.widget.kind === 'WEBSITE'
    ? new URL(props.widget.config.url).hostname
    : '',
)
const openUrl = computed(() =>
  props.widget.kind === 'WEBSITE' && validUrl.value
    ? props.widget.config.url
    : props.widget.kind === 'AGENDA'
      ? `/event?filter=${encodeURIComponent(JSON.stringify(props.widget.config.filter))}`
      : props.widget.kind === 'TABLE'
        ? `/table/${props.widget.config.entity}?filter=${encodeURIComponent(JSON.stringify(props.widget.config.filter))}`
        : '',
)
async function refresh() {
  if (props.widget.kind === 'KPI') {
    loading.value = true
    try {
      kpi.value =
        (
          await ApiGenericService.findByHandles<KPIItem>('kpi', [props.widget.config.kpiHandle])
        )[0] ?? null
    } catch {
      kpi.value = null
    } finally {
      loading.value = false
    }
  } else if (props.widget.kind === 'WEBSITE') frameKey.value++
  else await content.value?.refresh()
}
onMounted(() => {
  if (props.widget.kind === 'KPI') void refresh()
})
</script>
