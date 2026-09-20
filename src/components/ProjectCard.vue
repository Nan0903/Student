<script setup lang="ts">
import { computed } from 'vue'
import { useEnumStore } from '@/stores/enums'
import { projectStatusEnumCode, projectStatusLabel, projectStatusTone } from '@/utils/format'
import type { Project, ProjectSkillTag } from '@/types'

const props = defineProps<{
  project: Project
  /** 关联技能点标签，由页面按「项目关联技能点」的关系算好传进来 */
  skills?: ProjectSkillTag[]
  /** 项目所属岗位名 */
  positionName?: string
  /** 是否显示「移出」按钮：只有学生自己加进「我的实训」的项目才移得动 */
  removable?: boolean
}>()

const emit = defineEmits<{ open: [project: Project]; remove: [project: Project] }>()

const enums = useEnumStore()

const tone = computed(() => projectStatusTone[props.project.status])
// 状态文案优先取后端字典，字典没加载到就用本地兜底
const label = computed(() =>
  enums.label(
    'student_project_status',
    projectStatusEnumCode[props.project.status],
    projectStatusLabel[props.project.status],
  ),
)
const locked = computed(() => props.project.status === 'locked')
const score = computed(() => props.project.score)

/** 关联技能点全部展示，不做「+N」折叠（卡片高度随内容长） */
const allSkills = computed(() => props.skills ?? [])

const barColor = computed(() => {
  switch (props.project.status) {
    case 'completed':
      return 'var(--ok)'
    case 'in_progress':
      return 'var(--wip)'
    case 'locked':
      return 'var(--lock)'
    default:
      return 'var(--brand-500)'
  }
})

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
      <header class="project-card__head">
        <span class="pill" :class="`pill--${tone}`">{{ label }}</span>
        <span v-if="project.isRequired" class="project-card__required" title="老师发任务点名要求完成">
          必修
        </span>
        <span class="project-card__score">
          <span class="project-card__score-label">最高分</span>
          <span class="project-card__score-value num" :class="{ 'is-empty': score == null }">
            {{ score ?? '—' }}
          </span>
        </span>
        <!-- 移出「我的实训」：卡片本身可点，所以这里要阻止冒泡 -->
        <button
          v-if="removable"
          class="project-card__remove"
          type="button"
          title="从关卡地图移除"
          @click.stop="emit('remove', props.project)"
        >
          移出
        </button>
      </header>

      <h4 class="project-card__name">{{ project.name }}</h4>

      <p class="project-card__position">
        <span class="meta-tag">所属岗位</span>
        <span class="project-card__position-name">{{ positionName ?? '未关联岗位' }}</span>
      </p>

      <div class="project-card__skills">
        <span class="meta-tag">关联技能点</span>
        <span
          v-for="skill in allSkills"
          :key="skill.id"
          class="skill-tag"
          :style="{ '--tone': skill.color }"
        >
          {{ skill.name }}
        </span>
        <span v-if="!allSkills.length" class="project-card__muted">暂无</span>
      </div>

      <footer class="project-card__foot">
        <span class="project-card__levels">
          <span class="meta-tag">关卡</span>
          <span class="num project-card__levels-value">{{ project.levelDone }}</span>
          <span class="project-card__levels-sep">/</span>
          <span class="num project-card__levels-total">{{ project.levelTotal }}</span>
          <span class="project-card__levels-unit">关</span>
        </span>
        <span class="project-card__bar" aria-hidden="true">
          <i :style="{ width: `${project.progress}%`, background: barColor }" />
        </span>
        <span class="project-card__percent num">{{ project.progress }}%</span>
      </footer>
    </article>
  </el-tooltip>
</template>

<style scoped>
/**
 * 项目卡：一行三个，同一行等高；技能点全部铺开，卡片高度随内容长。
 * 信息顺序 —— 状态 / 最高分 → 项目名称 → 所属岗位 → 关联技能点 → 关卡进度。
 */
.project-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* 撑满所在行（同行等高），但内容多的时候可以更高 */
  height: 100%;
  min-height: 248px;
  padding: 16px;
  overflow: hidden;
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

/* —— 状态 + 最高分 —— */
.project-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 必修标记紧跟状态药丸，最高分靠右 */
.project-card__required {
  flex: none;
  padding: 0 7px;
  border-radius: var(--r-chip);
  background: var(--wip-bg);
  color: #b35c00;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.project-card__score {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-left: auto;
}

.project-card__score-label {
  color: var(--ink-3);
  font-size: 11px;
}

.project-card__score-value {
  color: var(--brand-600);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.project-card__score-value.is-empty {
  color: var(--ink-3);
}

/* 移出「我的实训」：低调的幽灵按钮，悬停才变红 */
.project-card__remove {
  flex: none;
  padding: 2px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-3);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.project-card__remove:hover {
  border-color: var(--danger);
  background: #fff1f0;
  color: var(--danger);
}

.is-locked .project-card__score-value {
  color: var(--ink-3);
}

/* —— 项目名称 —— */
.project-card__name {
  display: -webkit-box;
  min-height: 44px;
  overflow: hidden;
  color: var(--ink-1);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* —— 所属岗位 —— */
.project-card__position {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--ink-2);
  font-size: 12.5px;
}

.project-card__position-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-tag {
  flex: none;
  padding: 0 7px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface-2);
  color: var(--ink-3);
  font-size: 11px;
  line-height: 18px;
}

/* —— 关联技能点 —— */
.project-card__skills {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 5px;
}

.skill-tag {
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--tone) 28%, #fff);
  border-radius: var(--r-chip);
  background: color-mix(in srgb, var(--tone) 9%, #fff);
  color: color-mix(in srgb, var(--tone) 58%, #1b2a44);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}

.is-locked .skill-tag {
  opacity: 0.7;
  filter: grayscale(0.7);
}

.project-card__muted {
  color: var(--ink-3);
  font-size: 12px;
}

/* —— 关卡进度 —— */
.project-card__foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.project-card__levels {
  display: flex;
  align-items: baseline;
  gap: 3px;
  flex: none;
}

.project-card__levels .meta-tag {
  margin-right: 3px;
}

.project-card__levels-value,
.project-card__levels-total {
  color: var(--ink-1);
  font-size: 15px;
  font-weight: 700;
}

.project-card__levels-sep,
.project-card__levels-unit {
  color: var(--ink-3);
  font-size: 12px;
}

.is-locked .project-card__levels-value,
.is-locked .project-card__levels-total {
  color: var(--ink-3);
}

.project-card__bar {
  display: block;
  flex: 1;
  min-width: 40px;
  height: 5px;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.project-card__bar i {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  transition: width 0.4s ease;
}

.project-card__percent {
  flex: none;
  width: 38px;
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}
</style>
