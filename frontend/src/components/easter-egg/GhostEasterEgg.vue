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
        :style="ghostStyle"
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

<style scoped>
.sapling-ghost-shell {
  --sapling-ghost-size: 64px;
  --sapling-ghost-idle-radius: 32px;
  position: fixed;
  top: 8px;
  z-index: 1200;
  display: grid;
  place-items: center;
  width: calc(var(--sapling-ghost-size) + var(--sapling-ghost-idle-radius));
  height: calc(var(--sapling-ghost-size) + 16px);
  pointer-events: none;
}

.sapling-ghost-shell--top-right {
  right: clamp(96px, 13vw, 220px);
}

.sapling-ghost-shell--ai-fab {
  top: calc(var(--v-layout-top, 0px) + 4px);
  left: 50%;
  z-index: var(--sapling-ai-chat-fab-z-index, 13001);
  transform: translateX(-50%);
}

.sapling-ghost-orbit {
  position: relative;
  width: var(--sapling-ghost-size);
  height: var(--sapling-ghost-size);
  pointer-events: none;
  transform-origin: 50% 78%;
  animation: sapling-ghost-drift 7.5s ease-in-out infinite;
}

.sapling-ghost {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  filter: drop-shadow(0 0 9px rgba(92, 202, 255, 0.42));
}

.sapling-ghost__sprite {
  display: block;
  width: 100%;
  height: 100%;
}

.sapling-ghost__glow {
  fill: rgba(88, 196, 255, 0.18);
}

.sapling-ghost__outline {
  fill: #2378b8;
}

.sapling-ghost__body {
  fill: #e9fbff;
}

.sapling-ghost__shine {
  fill: #ffffff;
}

.sapling-ghost__eyes,
.sapling-ghost__mouth,
.sapling-ghost__arm {
  fill: #125484;
}

.sapling-ghost__eyes--blink,
.sapling-ghost__mouth--happy,
.sapling-ghost__arm--wave,
.sapling-ghost--pose-blink .sapling-ghost__eyes--open,
.sapling-ghost--pose-happy .sapling-ghost__mouth--idle,
.sapling-ghost--pose-jump .sapling-ghost__mouth--idle,
.sapling-ghost--pose-wave .sapling-ghost__mouth--idle {
  display: none;
}

.sapling-ghost--pose-blink .sapling-ghost__eyes--blink,
.sapling-ghost--pose-happy .sapling-ghost__mouth--happy,
.sapling-ghost--pose-jump .sapling-ghost__mouth--happy,
.sapling-ghost--pose-wave .sapling-ghost__mouth--happy,
.sapling-ghost--pose-wave .sapling-ghost__arm--wave {
  display: block;
}

.sapling-ghost-orbit--status-jumping {
  animation:
    sapling-ghost-drift 7.5s ease-in-out infinite,
    sapling-ghost-jump 760ms cubic-bezier(0.17, 0.84, 0.44, 1);
}

.sapling-ghost-bubble {
  position: absolute;
  left: 50%;
  top: calc(100% - 5px);
  max-width: min(280px, calc(100vw - 32px));
  padding: 8px 10px;
  border: 1px solid rgba(80, 170, 220, 0.4);
  border-radius: 8px;
  background: rgba(248, 253, 255, 0.96);
  color: #164467;
  box-shadow: 0 8px 24px rgba(20, 57, 88, 0.16);
  font-size: 0.78rem;
  line-height: 1.3;
  text-align: left;
  white-space: normal;
  pointer-events: none;
  transform: translateX(-50%);
}

.sapling-ghost-bubble::before {
  position: absolute;
  top: -5px;
  left: 50%;
  width: 9px;
  height: 9px;
  border-top: 1px solid rgba(80, 170, 220, 0.4);
  border-left: 1px solid rgba(80, 170, 220, 0.4);
  background: rgba(248, 253, 255, 0.96);
  content: '';
  transform: translateX(-50%) rotate(45deg);
}

.sapling-ghost-shell-enter-active,
.sapling-ghost-shell-leave-active,
.sapling-ghost-bubble-enter-active,
.sapling-ghost-bubble-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.sapling-ghost-shell-enter-from,
.sapling-ghost-shell-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.92);
}

.sapling-ghost-shell--ai-fab.sapling-ghost-shell-enter-from,
.sapling-ghost-shell--ai-fab.sapling-ghost-shell-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px) scale(0.92);
}

.sapling-ghost-shell--ai-fab.sapling-ghost-shell-enter-to,
.sapling-ghost-shell--ai-fab.sapling-ghost-shell-leave-from {
  transform: translateX(-50%);
}

.sapling-ghost-bubble-enter-from,
.sapling-ghost-bubble-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

@keyframes sapling-ghost-drift {
  0%,
  100% {
    transform: translate(calc(var(--sapling-ghost-idle-radius) * -0.5), 1px);
  }
  25% {
    transform: translate(calc(var(--sapling-ghost-idle-radius) * 0.5), -4px);
  }
  50% {
    transform: translate(calc(var(--sapling-ghost-idle-radius) * 0.2), 2px);
  }
  75% {
    transform: translate(calc(var(--sapling-ghost-idle-radius) * -0.35), -3px);
  }
}

@keyframes sapling-ghost-jump {
  0%,
  100% {
    translate: 0 0;
    scale: 1;
  }
  28% {
    translate: 0 -18px;
    scale: 0.96 1.08;
  }
  62% {
    translate: 0 2px;
    scale: 1.05 0.94;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sapling-ghost-orbit,
  .sapling-ghost-orbit--status-jumping {
    animation: none;
  }

  .sapling-ghost-orbit--status-jumping {
    transform: translateY(-3px);
  }

  .sapling-ghost-shell-enter-active,
  .sapling-ghost-shell-leave-active,
  .sapling-ghost-bubble-enter-active,
  .sapling-ghost-bubble-leave-active {
    transition-duration: 80ms;
  }
}

@media (max-width: 700px) {
  .sapling-ghost-shell--top-right {
    right: 76px;
  }

  .sapling-ghost-bubble {
    left: 50%;
    max-width: calc(100vw - 24px);
  }
}
</style>
