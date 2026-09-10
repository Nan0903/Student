<script setup lang="ts">
import { computed } from 'vue'
import { projectStatusIcon, projectStatusLabel, projectStatusTone } from '@/utils/format'
import type { Project } from '@/types'

const props = defineProps<{ project: Project }>()
const emit = defineEmits<{ open: [project: Project] }>()

const tone = computed(() => projectStatusTone[props.project.status])
const label = computed(() => projectStatusLabel[props.project.status])
const icon = computed(() => projectStatusIcon[props.project.status])
const locked = computed(() => props.project.status === 'locked')

function onClick(): void {
  emit('open', props.project)
}
</script>

<template>
  <el-tooltip
    :disabled="!locked"
    :content="project.lockReason ?? '完成前置关卡即可解锁'"
    placement="top"
  >
    <article
      class="project-card"
      :class="{ 'is-locked': locked }"
      tabindex="0"
      role="button"
      @click="onClick"
      @keydown.enter.prevent="onClick"
      @keydown.space.prevent="onClick"
    >
      <div class="project-card__top">
        <span class="project-card__icon" aria-hidden="true">{{ project.icon }}</span>
        <span class="pill" :class="`pill--${tone}`">
          <span aria-hidden="true">{{ icon }}</span>
          <span v-if="project.status === 'completed' && project.score" class="num">
            {{ project.score }}分
          </span>
          <span v-else>{{ label }}</span>
        </span>
      </div>

      <h4 class="project-card__name">{{ project.name }}</h4>

      <div class="project-card__meta">
        <span class="num">{{ project.levelDone }}</span>
        <span class="project-card__meta-sep">/</span>
        <span class="num">{{ project.levelTotal }}</span>
        <span class="project-card__meta-label">关卡</span>
      </div>

      <el-progress
        :percentage="project.progress"
        :stroke-width="6"
        :show-text="false"
        :color="tone === 'done' ? '#52c41a' : tone === 'wip' ? '#fa8c16' : '#1677ff'"
      />

      <p class="project-card__foot">
        <template v-if="locked">{{ project.lockReason ?? '完成更多基础项目即可解锁' }}</template>
        <template v-else-if="project.status === 'completed'">点击回看历史记录与教师点评</template>
        <template v-else-if="project.status === 'in_progress'">继续第 {{ project.levelDone + 1 }} 关</template>
        <template v-else>开始第一关</template>
      </p>
    </article>
  </el-tooltip>
</template>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  min-width: 200px;
  padding: 16px 16px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--sh-1);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  border-color: var(--brand-300);
  box-shadow: var(--sh-2);
}

.project-card.is-locked {
  background: var(--lock-bg);
  border-color: var(--lock-line);
  cursor: not-allowed;
}

.project-card.is-locked:hover {
  transform: none;
  border-color: var(--lock-line);
  box-shadow: var(--sh-1);
}

.project-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.project-card__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: var(--r-sm);
  background: var(--brand-050);
  font-size: 22px;
}

.is-locked .project-card__icon {
  background: #ececec;
  filter: grayscale(1);
  opacity: 0.7;
}

.project-card__name {
  min-height: 44px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.is-locked .project-card__name,
.is-locked .project-card__meta,
.is-locked .project-card__foot {
  color: var(--ink-3);
}

.project-card__meta {
  display: flex;
  align-items: baseline;
  gap: 3px;
  color: var(--ink-2);
  font-size: 12px;
}

.project-card__meta .num {
  color: var(--ink-1);
  font-size: 16px;
  font-weight: 700;
}

.project-card__meta-label {
  margin-left: 4px;
  color: var(--ink-3);
}

.project-card__foot {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
}
</style>
