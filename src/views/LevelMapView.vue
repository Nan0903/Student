<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import PageTitle from '@/components/PageTitle.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import { useChatStore } from '@/stores/chat'
import { usePositionStore } from '@/stores/position'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import { tierLabel, tierOrder } from '@/utils/format'
import type { Project, ProjectSkillTag } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const positionStore = usePositionStore()
const skillStore = useSkillStore()
const chat = useChatStore()

const ALL = 'all'
const selectedPosition = ref<string>(ALL)
const highlightProjectId = ref('')
const skillFilter = ref('')

const legend = [
  { tone: 'lock', label: '未解锁' },
  { tone: 'todo', label: '可挑战' },
  { tone: 'wip', label: '进行中' },
  { tone: 'done', label: '已完成' },
]

const loading = computed(() => projectStore.loading || positionStore.loading)

const filteredProjects = computed(() => {
  if (selectedPosition.value === ALL) return projectStore.projects
  return projectStore.projects.filter((project) => project.positionId === selectedPosition.value)
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

/** 岗位名表：项目卡上展示「所属岗位」 */
const positionNames = computed(
  () => new Map(positionStore.positions.map((position) => [position.id, position.name])),
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

/** 岗位筛选与技能参数同步到地址栏，便于分享与回退 */
function syncQuery(): void {
  const query: Record<string, string> = {}
  if (selectedPosition.value !== ALL) query.position = selectedPosition.value
  if (skillFilter.value) query.skill = skillFilter.value
  if (highlightProjectId.value) query.project = highlightProjectId.value
  void router.replace({ path: '/map', query })
}

watch([selectedPosition, skillFilter], () => syncQuery())

onMounted(async () => {
  chat.contextLabel = '关卡地图 · 查看可挑战的实训项目'
  await Promise.all([projectStore.load(), positionStore.load(), skillStore.load()])

  const positionQuery = typeof route.query.position === 'string' ? route.query.position : ''
  const skillQuery = typeof route.query.skill === 'string' ? route.query.skill : ''
  const projectQuery = typeof route.query.project === 'string' ? route.query.project : ''

  // 默认展示全部岗位：后端一个项目只绑一个岗位，按当前岗位过滤经常会是一张空列表
  selectedPosition.value = positionQuery || ALL
  skillFilter.value = skillQuery
  highlightProjectId.value = projectQuery
})
</script>

<template>
  <div class="level-map">
    <PageTitle
      title="关卡地图"
    >
      <template #extra>
        <ul class="legend">
          <li v-for="item in legend" :key="item.tone" class="legend__item">
            <span class="legend__dot" :class="`legend__dot--${item.tone}`" />
            {{ item.label }}
          </li>
        </ul>
      </template>
    </PageTitle>

    <!-- 岗位筛选 -->
    <div class="filter panel">
      <span class="filter__label">岗位筛选</span>
      <div class="filter__tags">
        <button
          class="filter-tag"
          :class="{ 'is-on': selectedPosition === ALL }"
          type="button"
          @click="selectedPosition = ALL"
        >
          全部岗位
        </button>
        <button
          v-for="position in positionStore.positions"
          :key="position.id"
          class="filter-tag"
          :class="{ 'is-on': selectedPosition === position.id }"
          type="button"
          @click="selectedPosition = position.id"
        >
          {{ position.name }}
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
              :position-name="positionNames.get(project.positionId)"
              @open="openProject"
            />
          </div>
        </div>
      </section>
    </template>

    <div v-else class="panel">
      <EmptyState
        title="该岗位暂无可挑战项目"
        description="切换其他岗位，或先完成基础实训解锁更多项目。"
        action-text="查看全部岗位"
        @action="selectedPosition = ALL"
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
  /* 固定一行三个，卡片尺寸不随内容变化 */
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
