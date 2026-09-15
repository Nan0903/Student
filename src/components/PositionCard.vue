<script setup lang="ts">
import { computed } from 'vue'
import { difficultyTone } from '@/utils/format'
import type { PositionView } from '@/types'

const props = withDefaults(
  defineProps<{
    position: PositionView
    variant?: 'compact' | 'select'
    pickable?: boolean
    picked?: boolean
  }>(),
  { variant: 'compact', pickable: false, picked: false },
)

const emit = defineEmits<{ open: [position: PositionView]; pick: [position: PositionView] }>()

const tone = computed(() => difficultyTone[props.position.difficulty])
const isCurrent = computed(() => props.position.selected)

function onClick(): void {
  if (props.pickable) {
    emit('pick', props.position)
    return
  }
  emit('open', props.position)
}
</script>

<template>
  <article
    class="position-card"
    :class="[
      `position-card--${variant}`,
      { 'is-picked': picked, 'is-current': isCurrent, 'is-pickable': pickable },
    ]"
    tabindex="0"
    role="button"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick"
  >
    <div class="position-card__head">
      <div class="position-card__title">
        <h3 class="position-card__name">
          {{ position.name }}
          <span v-if="isCurrent" class="position-card__current">当前</span>
          <span v-if="pickable && picked" class="position-card__picked">已选择</span>
        </h3>
        <p class="position-card__level">
          {{ position.levelFrom }}
          <span class="position-card__arrow">→</span>
          {{ position.levelTo }}
          <span class="position-card__direction">{{ position.direction }}</span>
        </p>
      </div>
      <div class="position-card__match">
        <span class="position-card__match-value num">{{ position.percent }}%</span>
        <span class="position-card__match-label">技能点进度</span>
      </div>
    </div>

    <p class="position-card__desc">{{ position.description }}</p>

    <div class="position-card__stats">
      <span class="stat">
        <span class="num">{{ position.heat }}</span>
        <span class="stat__label">热度</span>
      </span>
      <span class="stat">
        <span class="num">{{ position.skillDone }}/{{ position.skillTotal }}</span>
        <span class="stat__label">技能点已完成</span>
      </span>
      <span class="stat">
        <span class="num">
          {{ position.projectTotal ? `${position.projectDone}/${position.projectTotal}` : '—' }}
        </span>
        <span class="stat__label">项目已完成</span>
      </span>
      <span class="pill" :class="`pill--${tone}`">{{ position.difficulty }}</span>
    </div>

    <div class="position-card__meter" aria-hidden="true">
      <span class="position-card__meter-fill" :style="{ width: `${position.percent}%` }" />
    </div>

    <div v-if="variant === 'compact'" class="position-card__foot">
      <span class="position-card__go">查看 →</span>
    </div>
  </article>
</template>

<style scoped>
.position-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--sh-1);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.position-card:hover {
  transform: translateY(-2px);
  border-color: var(--brand-300);
  box-shadow: var(--sh-2);
}

.position-card.is-current {
  border-color: var(--brand-500);
  background: linear-gradient(180deg, var(--brand-050), #fff 58%);
}

.position-card.is-picked {
  border-color: var(--brand-500);
  box-shadow: 0 0 0 2px var(--brand-100), var(--sh-2);
}

.position-card__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.position-card__title {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.position-card__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
}

.position-card__current {
  padding: 0 7px;
  border-radius: var(--r-chip);
  background: var(--brand-500);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.position-card__picked {
  padding: 0 7px;
  border: 1px solid var(--brand-300);
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.position-card__level {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  font-size: 12px;
}

.position-card__arrow {
  color: var(--ink-3);
}

.position-card__direction {
  margin-left: 4px;
  padding: 0 8px;
  border-radius: var(--r-chip);
  background: var(--surface-2);
  color: var(--ink-2);
  line-height: 19px;
}

.position-card__match {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
}

.position-card__match-value {
  color: var(--brand-600);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
}

.position-card__match-label {
  color: var(--ink-3);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.position-card__desc {
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink-2);
  font-size: 13px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.position-card__stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.stat {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-2);
}

.stat .num {
  color: var(--ink-1);
  font-size: 14px;
  font-weight: 700;
}

.stat__label {
  color: var(--ink-3);
}

.position-card__stats .pill {
  margin-left: auto;
}

.position-card__meter {
  height: 4px;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.position-card__meter-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  background: linear-gradient(90deg, var(--brand-600), #4aa3ff);
}

.position-card__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  color: var(--ink-3);
  font-size: 12px;
}

.position-card__go {
  color: var(--brand-600);
  font-weight: 600;
}

/* —— 岗位选择页：三列网格卡片，信息更全 —— */
.position-card--select {
  height: 100%;
  padding: 22px;
}

.position-card--select .position-card__name {
  font-size: 17px;
}

.position-card--select .position-card__desc {
  min-height: 42px;
  -webkit-line-clamp: 3;
}
</style>
