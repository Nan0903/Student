<script setup lang="ts">
import { computed } from 'vue'
import type { SkillNode } from '@/types'

const props = defineProps<{
  node: SkillNode
  color: string
  isActive?: boolean
}>()

const emit = defineEmits<{ select: [node: SkillNode] }>()

const lit = computed(() => props.node.status !== 'locked')
const mastered = computed(() => props.node.status === 'mastered')
const showProgress = computed(
  () => props.node.status === 'active' && props.node.progress.total > 1,
)
const progressText = computed(() => `${props.node.progress.current}/${props.node.progress.total}`)
</script>

<template>
  <button
    class="skill-node"
    :class="{ 'is-lit': lit, 'is-mastered': mastered, 'is-locked': !lit, 'is-active': isActive }"
    type="button"
    :style="{ '--node-color': color }"
    @click="emit('select', node)"
  >
    <span class="skill-node__box">
      <span class="skill-node__glyph" aria-hidden="true">{{ node.icon }}</span>
      <span v-if="mastered" class="skill-node__star" aria-hidden="true">★</span>
      <span v-else-if="lit" class="skill-node__tick" aria-hidden="true">✓</span>
      <span v-else class="skill-node__lock" aria-hidden="true">🔒</span>
      <span v-if="showProgress" class="skill-node__progress num">{{ progressText }}</span>
    </span>
    <span class="skill-node__name">{{ node.name }}</span>
  </button>
</template>

<style scoped>
.skill-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.skill-node__box {
  position: relative;
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 18px;
  background: var(--night-3);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.skill-node:hover .skill-node__box {
  transform: translateY(-2px);
}

.skill-node__glyph {
  font-size: 28px;
  filter: saturate(0.9);
}

.skill-node.is-lit .skill-node__box {
  background: color-mix(in srgb, var(--node-color) 26%, var(--night-2));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--node-color) 60%, transparent),
    0 0 16px color-mix(in srgb, var(--node-color) 26%, transparent);
}

.skill-node.is-mastered .skill-node__box {
  box-shadow:
    inset 0 0 0 2px var(--gold),
    0 0 18px color-mix(in srgb, var(--node-color) 34%, transparent);
}

.skill-node.is-active .skill-node__box {
  box-shadow:
    inset 0 0 0 2px #fff,
    0 0 0 4px color-mix(in srgb, var(--node-color) 30%, transparent),
    0 0 22px color-mix(in srgb, var(--node-color) 40%, transparent);
}

.skill-node.is-locked .skill-node__box {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.skill-node.is-locked .skill-node__glyph {
  opacity: 0.32;
  filter: grayscale(1);
}

.skill-node__tick,
.skill-node__lock,
.skill-node__star {
  position: absolute;
  top: -5px;
  right: -5px;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.skill-node__tick {
  background: var(--ok);
  color: #fff;
  box-shadow: 0 0 0 2px var(--night);
}

.skill-node__star {
  background: var(--gold);
  color: #6b4a00;
  box-shadow: 0 0 0 2px var(--night);
}

.skill-node__lock {
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 0 0 2px var(--night);
  font-size: 10px;
  opacity: 0.8;
}

.skill-node__progress {
  position: absolute;
  right: -6px;
  bottom: -6px;
  padding: 0 7px;
  border-radius: var(--r-pill);
  background: #fff;
  color: var(--night);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  box-shadow: 0 0 0 2px var(--night);
}

.skill-node__name {
  max-width: 84px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
}

.skill-node.is-locked .skill-node__name {
  color: rgba(255, 255, 255, 0.38);
}
</style>
