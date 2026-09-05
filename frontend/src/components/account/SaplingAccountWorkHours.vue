<template>
  <section class="sapling-account-dialog__workhours">
    <div v-if="$vuetify.display.smAndDown" class="sapling-workhours-list mt-4">
      <article
        v-for="workHourRow in workHourRows"
        :key="workHourRow.key"
        class="sapling-workhours-card"
        :class="{
          'sapling-selected-item': workHourRow.key === workHourRows[currentWeekday]?.key,
        }"
      >
        <div class="sapling-workhours-card__day">
          {{ $t(`workHourWeek.${workHourRow.key}`) }}
        </div>
        <div class="sapling-workhours-card__times">
          <div class="sapling-workhours-card__time-row">
            <span class="sapling-workhours-card__label">{{ $t('workHour.timeFrom') }}</span>
            <span>{{ workHourRow.timeFrom }}</span>
          </div>
          <div class="sapling-workhours-card__time-row">
            <span class="sapling-workhours-card__label">{{ $t('workHour.timeTo') }}</span>
            <span>{{ workHourRow.timeTo }}</span>
          </div>
        </div>
      </article>
    </div>
    <SaplingDataTable
      v-else
      class="sapling-workhours-table mt-4"
      :items="workHourRows"
      :columns="[
        {
          key: 'c0',
          title: $t('workHour.workTime'),
          value: (workHourRow) => $t(`workHourWeek.${workHourRow.key}`),
        },
        {
          key: 'c1',
          title: $t('workHour.timeFrom'),
          value: (workHourRow) => workHourRow.timeFrom,
        },
        {
          key: 'c2',
          title: $t('workHour.timeTo'),
          value: (workHourRow) => workHourRow.timeTo,
        },
      ]"
    >
      <template #row="{ item: workHourRow }">
        <tr
          :class="{
            'sapling-selected-item': workHourRow.key === workHourRows[currentWeekday]?.key,
          }"
        >
          <td>{{ $t(`workHourWeek.${workHourRow.key}`) }}</td>
          <td>{{ workHourRow.timeFrom }}</td>
          <td>{{ workHourRow.timeTo }}</td>
        </tr>
      </template>
    </SaplingDataTable>
  </section>
</template>
<script setup lang="ts">
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
import type { WorkHourRow } from '@/composables/account/saplingAccount.utils'
defineProps<{ workHourRows: WorkHourRow[]; currentWeekday: number }>()
</script>
