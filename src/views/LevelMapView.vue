<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import { useChatStore } from '@/stores/chat'
import { useEnumStore } from '@/stores/enums'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import { tierLabel, tierOrder } from '@/utils/format'
import type { Project, ProjectSkillTag } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const skillStore = useSkillStore()
const chat = useChatStore()
const enums = useEnumStore()

/** 项目来源筛选：全部岗位（地图上全部项目）/ 自主选择（自己点「+」加的）/ 下发任务（老师点名必修） */
type MapSource = 'all' | 'self' | 'teacher'

const sourceOptions: { value: MapSource; label: string }[] = [
  { value: 'all', label: '全部岗位' },
  { value: 'self', label: '自主选择' },
  { value: 'teacher', label: '下发任务' },
]

const selectedSource = ref<MapSource>('all')
const highlightProjectId = ref('')
const skillFilter = ref('')

/**
 * 图例：文案取后端字典（student_project_status）。
 * 地图上只有学生自己加入的项目，没有「未解锁」这一态，锁定留给项目内部的关卡。
 */
const legend = computed(() => [
  { tone: 'todo', label: enums.label('student_project_status', 'NOT_STARTED', '可挑战') },
  { tone: 'wip', label: enums.label('student_project_status', 'IN_PROGRESS', '进行中') },
  { tone: 'done', label: enums.label('student_project_status', 'COMPLETED', '已完成') },
])

const loading = computed(() => projectStore.loading || skillStore.loading)

/**
 * 地图上只放「我的实训」里的项目 = 学生自己挑的（技能树点「+」）∪ 老师发任务点名必修的。
 * 两个来源都在项目列表接口里带了标记，所以不用额外再拉一次清单。
 */
const mapProjects = computed(() =>
  projectStore.projects.filter((project) => project.picked || project.isRequired),
)

const filteredProjects = computed(() => {
  if (selectedSource.value === 'self') return mapProjects.value.filter((project) => project.picked)
  if (selectedSource.value === 'teacher') {
    return mapProjects.value.filter((project) => project.isRequired)
  }
  return mapProjects.value
})

const skillProjectIds = computed(() => {
  if (!skillFilter.value) return []
  return skillStore.projectsOfNode(skillFilter.value).map((project) => project.id)
})

const skillName = computed(() =>
  skillFilter.value ? (skillStore.getNode(skillFilter.value)?.name ?? '') : '',
)

/** 体系取色表：项目卡上的技能点标签跟随所属体系配色 */
const systemColors = computed(
  () => new Map(skillStore.systems.map((system) => [system.id, system.color])),
)

/** 项目挂靠的技能点 → 卡片上的小标签 */
function skillTags(project: Project): ProjectSkillTag[] {
  return skillStore.nodesOfProject(project.id).map((node) => ({
    id: node.id,
    name: node.name,
    color: systemColors.value.get(node.systemId) ?? '#1e7be8',
  }))
}

const groups = computed(() =>
  tierOrder.map((tier) => {
    const list = filteredProjects.value
      .filter((project) => project.tier === tier)
      .sort((a, b) => {
        const aHit = skillProjectIds.value.includes(a.id) ? 0 : 1
        const bHit = skillProjectIds.value.includes(b.id) ? 0 : 1
        return aHit - bHit
      })
    return {
      tier,
      name: tierLabel[tier],
      done: list.filter((project) => project.status === 'completed').length,
      total: list.length,
      projects: list,
    }
  }),
)

const visibleGroups = computed(() => groups.value.filter((group) => group.projects.length > 0))

function isHighlighted(project: Project): boolean {
  if (!highlightProjectId.value) return false
  return project.id === highlightProjectId.value
}

function openProject(project: Project): void {
  if (project.status === 'locked') {
    ElMessage.warning(project.lockReason ?? '完成前置关卡即可解锁')
    return
  }
  void router.push(`/map/project/${project.id}`)
}

/** 清掉岗位与技能筛选，回到「全部已加入的项目」 */
function clearFilters(): void {
  selectedSource.value = 'all'
  skillFilter.value = ''
}

/**
 * 把自己加进「我的实训」的项目移出。
 *
 * 老师点名必修的项目移出后仍会留在地图上（必修是任务实时算的），所以文案要说清楚。
 */
async function removeProject(project: Project): Promise<void> {
  try {
    await ElMessageBox.confirm(
      project.isRequired
        ? `「${project.name}」是老师点名的必修项目，移除后仍会留在你的关卡地图上。确认移除？`
        : `把「${project.name}」从关卡地图移除？已经开始的闯关记录不会丢，之后还能重新加入。`,
      '移除关卡地图',
      { confirmButtonText: '移出', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await projectStore.unpickProject(project.id)
    ElMessage.success(
      project.isRequired
        ? `已把「${project.name}」移除关卡地图；它是必修项目，仍会留在地图上`
        : `已把「${project.name}」移除关卡地图`,
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败，请稍后重试')
  }
}

/** 来源筛选与技能参数同步到地址栏，便于分享与回退 */
function syncQuery(): void {
  const query: Record<string, string> = {}
  if (selectedSource.value !== 'all') query.source = selectedSource.value
  if (skillFilter.value) query.skill = skillFilter.value
  if (highlightProjectId.value) query.project = highlightProjectId.value
  void router.replace({ path: '/map', query })
}

watch([selectedSource, skillFilter], () => syncQuery())

onMounted(async () => {
  chat.contextLabel = '关卡地图 · 查看可挑战的实训项目'
  await Promise.all([projectStore.load(), skillStore.load()])

  const sourceQuery = typeof route.query.source === 'string' ? route.query.source : ''
  const skillQuery = typeof route.query.skill === 'string' ? route.query.skill : ''
  const projectQuery = typeof route.query.project === 'string' ? route.query.project : ''

  // 地址栏里的来源筛选只认这三个值，认不出来就回落到「全部岗位」
  selectedSource.value = sourceOptions.some((item) => item.value === sourceQuery)
    ? (sourceQuery as MapSource)
    : 'all'
  skillFilter.value = skillQuery
  highlightProjectId.value = projectQuery
})
</script>

<template>
  <div class="level-map">
    <!-- 顶部工具条：页面级标题已按设计移除，只留历史记录入口与状态图例 -->
    <div class="page-toolbar">
      <!-- 只能从关卡地图进入历史记录，页面里没有独立导航项 -->
      <button class="history-entry" type="button" @click="router.push('/map/history')">
        历史记录
      </button>
      <ul class="legend">
        <li v-for="item in legend" :key="item.tone" class="legend__item">
          <span class="legend__dot" :class="`legend__dot--${item.tone}`" />
          {{ item.label }}
        </li>
      </ul>
    </div>

    <!-- 项目筛选：全部岗位 / 自主选择 / 下发任务（技能筛选是技能树点过来的临时过滤） -->
    <div v-if="mapProjects.length" class="filter panel">
      <span class="filter__label">项目筛选</span>
      <div class="filter__tags">
        <button
          v-for="item in sourceOptions"
          :key="item.value"
          class="filter-tag"
          :class="{ 'is-on': selectedSource === item.value }"
          type="button"
          @click="selectedSource = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <button v-if="skillFilter" class="skill-chip" type="button" @click="skillFilter = ''">
        技能：{{ skillName }}
        <span class="skill-chip__clear">清除</span>
      </button>
    </div>

    <!-- 层级分组 -->
    <template v-if="loading">
      <section v-for="index in 3" :key="index" class="tier-block">
        <div class="tier-skeleton skeleton" />
      </section>
    </template>

    <template v-else-if="visibleGroups.length">
      <section v-for="group in visibleGroups" :key="group.tier" class="tier-block panel">
        <header class="tier-block__head">
          <div class="tier-block__title">
            <span class="tier-block__name">{{ group.name }}</span>
          </div>
          <span class="tier-block__progress">
            <span class="num">{{ group.done }}</span> /
            <span class="num">{{ group.total }}</span> 已完成
          </span>
        </header>

        <div class="tier-block__row">
          <div
            v-for="project in group.projects"
            :key="project.id"
            class="card-wrap"
            :class="{ 'is-highlight': isHighlighted(project) }"
          >
            <ProjectCard
              :project="project"
              :skills="skillTags(project)"
              :position-name="project.positionName"
              :removable="project.picked"
              @open="openProject"
              @remove="removeProject"
            />
          </div>
        </div>
      </section>
    </template>

    <!-- 一条都没有：入口在「技能选项」（自己挑）或教师端任务（必修） -->
    <div v-else-if="!mapProjects.length" class="panel">
      <EmptyState
        title="还没有加入任何项目"
        description="去「技能选项」（技能体系或岗位体系）点开一个技能点 / 岗位，在项目右边点「+」加入；老师布置的必修项目也会自动出现在这里。"
        action-text="去技能选项挑项目"
        @action="router.push('/skill-tree')"
      />
    </div>

    <div v-else class="panel">
      <EmptyState
        title="当前筛选下没有项目"
        description="换个筛选看看，或者清掉技能筛选，显示全部已加入的项目。"
        action-text="查看全部已加入项目"
        @action="clearFilters"
      />
    </div>
  </div>
</template>

<style scoped>
.level-map {
  display: flex;
  flex-direction: column;
}

/* —— 图例 —— */
.legend {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  box-shadow: var(--sh-1);
}

/* 顶部工具条里的「历史记录」入口（跳转 /map/history） */
.history-entry {
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.history-entry:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  font-size: 12px;
}

.legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend__dot--lock {
  background: var(--lock);
}

.legend__dot--todo {
  background: var(--todo);
}

.legend__dot--wip {
  background: var(--wip);
}

.legend__dot--done {
  background: var(--ok);
}

/* —— 筛选条 —— */
.filter {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 18px;
  margin-bottom: 18px;
}

.filter__label {
  color: var(--ink-3);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.filter__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.filter-tag:hover {
  border-color: var(--brand-300);
  color: var(--brand-600);
}

.filter-tag.is-on {
  border-color: var(--brand-500);
  background: var(--brand-050);
  color: var(--brand-600);
  box-shadow: 0 0 0 2px var(--brand-100);
}

.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 5px 14px;
  border: 1px dashed var(--brand-300);
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.skill-chip__clear {
  padding-left: 8px;
  border-left: 1px solid var(--brand-300);
  color: var(--brand-600);
  opacity: 0.75;
}

/* —— 层级区块 —— */
.tier-block {
  padding: 18px 20px 20px;
}

.tier-block + .tier-block,
.tier-block + .panel {
  margin-top: 16px;
}

.tier-block__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px dashed var(--line);
}

.tier-block__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.tier-block__name {
  font-size: 16px;
  font-weight: 700;
}

.tier-block__progress {
  color: var(--ink-2);
  font-size: 12px;
}

.tier-block__progress .num {
  color: var(--brand-600);
  font-size: 15px;
  font-weight: 700;
}

.tier-block__row {
  display: grid;
  /* 固定一行三个；同一行等高，卡片高度随「关联技能点」的数量长 */
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 4px 0;
}

.card-wrap {
  border-radius: var(--r-md);
  transition: box-shadow 0.2s ease;
}

.card-wrap.is-highlight {
  box-shadow: 0 0 0 3px var(--brand-100), 0 0 0 1px var(--brand-500);
}

.tier-skeleton {
  height: 240px;
  border-radius: var(--r-md);
}
</style>
