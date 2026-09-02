<template>
  <Teleport to="body" :disabled="placement === 'ai-fab'">
    <Transition name="sapling-ghost-shell">
      <div
        v-if="isVisible"
        class="sapling-ghost-shell"
        :class="[
          `sapling-ghost-shell--${placement === 'overlay' ? config.position : placement}`,
          `sapling-ghost-shell--${status}`,
        ]"
        v-css-vars="ghostStyle"
        aria-live="polite"
      >
        <div class="sapling-ghost-orbit" :class="`sapling-ghost-orbit--status-${status}`">
          <Transition name="sapling-ghost-bubble">
            <div v-if="isMessageVisible" class="sapling-ghost-bubble">
              {{ message }}
            </div>
          </Transition>

          <button
            class="sapling-ghost"
            :class="ghostPoseClass[pose]"
            type="button"
            aria-label="Ghosty"
            title="Ghosty"
            @click="onGhostClick"
          >
            <svg
              class="sapling-ghost__sprite"
              viewBox="0 0 16 16"
              role="img"
              aria-hidden="true"
              shape-rendering="crispEdges"
            >
              <g class="sapling-ghost__glow">
                <rect x="4" y="1" width="8" height="1" />
                <rect x="3" y="2" width="10" height="1" />
                <rect x="2" y="3" width="12" height="9" />
                <rect x="1" y="5" width="14" height="6" />
              </g>

              <g class="sapling-ghost__outline">
                <rect x="5" y="1" width="6" height="1" />
                <rect x="4" y="2" width="8" height="1" />
                <rect x="3" y="3" width="10" height="1" />
                <rect x="2" y="4" width="12" height="7" />
                <rect x="2" y="11" width="3" height="1" />
                <rect x="6" y="11" width="4" height="1" />
                <rect x="11" y="11" width="3" height="1" />
                <rect x="2" y="12" width="2" height="1" />
                <rect x="7" y="12" width="2" height="1" />
                <rect x="12" y="12" width="2" height="1" />
              </g>

              <g class="sapling-ghost__body">
                <rect x="5" y="2" width="6" height="1" />
                <rect x="4" y="3" width="8" height="1" />
                <rect x="3" y="4" width="10" height="1" />
                <rect x="3" y="5" width="10" height="6" />
                <rect x="3" y="11" width="2" height="1" />
                <rect x="7" y="11" width="2" height="1" />
                <rect x="12" y="11" width="1" height="1" />
              </g>

              <g class="sapling-ghost__shine">
                <rect x="5" y="3" width="2" height="1" />
                <rect x="4" y="4" width="1" height="3" />
                <rect x="5" y="5" width="1" height="1" />
              </g>

              <g class="sapling-ghost__eyes sapling-ghost__eyes--open">
                <rect x="5" y="6" width="2" height="2" />
                <rect x="10" y="6" width="2" height="2" />
              </g>
              <g class="sapling-ghost__eyes sapling-ghost__eyes--blink">
                <rect x="5" y="7" width="2" height="1" />
                <rect x="10" y="7" width="2" height="1" />
              </g>
              <g class="sapling-ghost__mouth sapling-ghost__mouth--idle">
                <rect x="7" y="9" width="2" height="1" />
              </g>
              <g class="sapling-ghost__mouth sapling-ghost__mouth--happy">
                <rect x="6" y="9" width="1" height="1" />
                <rect x="7" y="10" width="3" height="1" />
                <rect x="10" y="9" width="1" height="1" />
              </g>
              <g class="sapling-ghost__arm sapling-ghost__arm--wave">
                <rect x="13" y="5" width="1" height="1" />
                <rect x="14" y="4" width="1" height="2" />
              </g>
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useGhostEasterEgg } from '@/composables/easter-egg/useGhostEasterEgg'
import { ghostPoseClass } from '@/config/easter-egg/ghostSprites'

const props = withDefaults(
  defineProps<{
    placement?: 'overlay' | 'ai-fab'
  }>(),
  {
    placement: 'overlay',
  },
)

const emit = defineEmits<{
  activate: []
}>()

const {
  status,
  pose,
  message,
  isMessageVisible,
  isVisible,
  sizePx,
  idleRadiusPx,
  config,
  handleGhostClick,
} = useGhostEasterEgg()

const ghostStyle = computed(() => ({
  '--sapling-ghost-size': sizePx.value,
  '--sapling-ghost-idle-radius': idleRadiusPx.value,
}))

const placement = computed(() => props.placement)

function onGhostClick() {
  handleGhostClick()
  emit('activate')
}
</script>
