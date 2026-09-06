<template>
  <div class="sapling-system-skeleton" aria-busy="true">
    <v-skeleton-loader type="article" />
    <div class="sapling-system-skeleton__metrics">
      <v-skeleton-loader v-for="item in 4" :key="item" type="article" />
    </div>
    <div class="sapling-system-skeleton__sections">
      <v-skeleton-loader type="article" />
      <v-skeleton-loader type="article" />
    </div>
  </div>
</template>
