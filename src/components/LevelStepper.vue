<script setup lang="ts">
import type { ModuleState } from '@/stores/project'

defineProps<{
  states: ModuleState[]
  activeId: string
}>()

const emit = defineEmits<{ select: [moduleId: string] }>()
</script>

<template>
  <ol class="stepper">
    <li
      v-for="(state, index) in states"
      :key="state.module.id"
      class="stepper__item"
      :class="[`is-${state.gate}`, { 'is-active': state.module.id === activeId }]"
    >
      <button
        class="stepper__btn"
        type="button"
        :disabled="state.gate === 'locked'"
        :title="state.gate === 'locked' ? '先通过上一关' : state.module.name"
        @click="emit('select', state.module.id)"
      >
        <span class="stepper__index num">
          {{ index + 1 }}
        </span>
        <span class="stepper__label">{{ state.module.name }}</span>
      </button>
      <span v-if="index < states.length - 1" class="stepper__line" aria-hidden="true" />
    </li>
  </ol>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
}

.stepper__item {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.stepper__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.stepper__btn:disabled {
  color: var(--ink-3);
  cursor: not-allowed;
}

.stepper__index {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 50%;
  background: var(--lock-bg);
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 700;
}

.stepper__item.is-done .stepper__index {
  background: var(--ok);
  color: #fff;
}

.stepper__item.is-done .stepper__btn {
  color: #2f8a08;
}

.stepper__item.is-current .stepper__index {
  background: linear-gradient(135deg, var(--brand-600), var(--brand-500));
  color: #fff;
  box-shadow: 0 0 0 3px var(--brand-100);
}

.stepper__item.is-current .stepper__btn,
.stepper__item.is-active .stepper__btn {
  color: var(--brand-600);
}

.stepper__item.is-active .stepper__btn {
  background: var(--brand-050);
  border-color: var(--brand-100);
}

.stepper__line {
  flex: 1;
  min-width: 12px;
  height: 2px;
  margin: 0 4px;
  border-radius: 1px;
  background: var(--line);
}

.stepper__item.is-done .stepper__line {
  background: var(--ok-line);
}
</style>
