<template>
  <SaplingCustomer360 v-if="isValidAnchor" :anchor="anchor" :record-handle="recordHandle" />
  <ErrorView v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import SaplingCustomer360 from '@/components/customer360/SaplingCustomer360.vue'
import ErrorView from '@/views/ErrorView.vue'
import type { Customer360Anchor } from '@/services/api.customer360.service'

const route = useRoute()
const anchor = computed(() => String(route.params.entityHandle) as Customer360Anchor)
const recordHandle = computed(() => String(route.params.handle))
const isValidAnchor = computed(() => anchor.value === 'company' || anchor.value === 'person')
</script>
