<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PositionCard from '@/components/PositionCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useChatStore } from '@/stores/chat'
import { usePositionStore } from '@/stores/position'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import {
  fetchProjectProgress,
  type ProjectProgress,
  type ProjectProgressScope,
} from '@/api/position'
import { tierLabel, tierOrder } from '@/utils/format'
import type { Position, PositionView, Project, SkillNode } from '@/types'

const router = useRouter()
const positionStore = usePositionStore()
const skillStore = useSkillStore()
const projectStore = useProjectStore()
const chat = useChatStore()

const drawerVisible = ref(false)
const drawerPosition = ref<Position | null>(null)

const LEVEL_BY_TIER: Record<'basic' | 'advanced' | 'extended', string> = {
  basic: 'BASIC',
  advanced: 'ADVANCED',
  extended: 'EXPANDED',
}

/** 「实训进度概览」的分母口径（三选一）：全部已发布 / 自主选择 / 下发任务 */
const progressScopes: { value: ProjectProgressScope; label: string }[] = [
  { value: 'ALL', label: '全部项目' },
  { value: 'SELF', label: '自主选择' },
  { value: 'TEACHER', label: '下发任务' },
]
const progressScope = ref<ProjectProgressScope>('ALL')
/** 三种口径的结果各缓存一份，来回切换不再重复请求 */
const progressByScope = ref<Partial<Record<ProjectProgressScope, ProjectProgress>>>({})
const currentProgress = computed(() => progressByScope.value[progressScope.value] ?? null)

async function loadProgress(scope: ProjectProgressScope): Promise<void> {
  if (progressByScope.value[scope]) return
  try {
    const progress = await fetchProjectProgress(scope)
    progressByScope.value = { ...progressByScope.value, [scope]: progress }
  } catch {
    /* 拿不到就用项目列表现算，页面不空 */
  }
}

function switchScope(scope: ProjectProgressScope): void {
  progressScope.value = scope
  void loadProgress(scope)
}

const loading = computed(() => positionStore.loading || skillStore.loading || projectStore.loading)
/** 我的推荐岗位：只展示推荐度最高的三个 */
const topPositions = computed(() => positionStore.rankedPositions.slice(0, 3))
const currentPosition = computed(() => positionStore.currentPosition)

/** 岗位 → 岗位技能点，按体系分组（岗位与技能点是多对多，人工维护在 Position.skillIds） */
const drawerGroups = computed(() => {
  const position = drawerPosition.value
  if (!position) return []
  const nodes = position.skillIds
    .map((id) => skillStore.getNode(id))
    .filter((node): node is SkillNode => node !== null)
  return skillStore.systems
    .map((system) => ({
      system,
      nodes: nodes.filter((node) => node.systemId === system.id),
    }))
    .filter((group) => group.nodes.length > 0)
})

/** 岗位技能点整体进度 */
const drawerProgress = computed(() => {
  const position = drawerPosition.value
  if (!position) return { total: 0, done: 0, percent: 0 }
  const nodes = position.skillIds
    .map((id) => skillStore.getNode(id))
    .filter((node): node is SkillNode => node !== null)
  return skillStore.progressOfNodes(nodes)
})

/**
 * 实训进度概览：取后端当前口径（全部项目 / 自主选择 / 下发任务）的三档进度。
 *
 * 三种口径都与岗位无关：全部口径就是项目库里能做的项目数，所以学生做完别的岗位的项目也会算进来。
 * 后端没返回时（请求失败 / 还在加载）按项目列表用同样的口径现算，保证页面不空。
 */
function inScope(project: Project): boolean {
  if (progressScope.value === 'SELF') return project.picked
  if (progressScope.value === 'TEACHER') return project.isRequired
  return true
}

const tierProgress = computed(() =>
  tierOrder.map((tier) => {
    const fromBackend = currentProgress.value?.levels.find(
      (level) => LEVEL_BY_TIER[tier] === level.levelType,
    )
    if (fromBackend) {
      return {
        tier,
        name: fromBackend.levelName || tierLabel[tier],
        done: fromBackend.completed,
        total: fromBackend.total,
      }
    }
    const list = projectStore.projects.filter((project) => project.tier === tier && inScope(project))
    return {
      tier,
      name: tierLabel[tier],
      done: list.filter((project) => project.status === 'completed').length,
      total: list.length,
    }
  }),
)

function openPosition(position: Position | PositionView): void {
  drawerPosition.value = position
  drawerVisible.value = true
}

/** 技能点 → 关卡地图，并带上岗位与技能筛选参数 */
function goSkill(node: SkillNode): void {
  if (skillStore.progressOf(node).percent >= 100) {
    ElMessage.info(`「${node.name}」已学成，可进入实训复习`)
  }
  drawerVisible.value = false
  void router.push({
    path: '/map',
    query: { skill: node.id },
  })
}

onMounted(async () => {
  chat.contextLabel = '成长中心 · 我的推荐岗位与实训进度'
  await Promise.all([positionStore.load(), skillStore.load(), projectStore.load()])
  await loadProgress(progressScope.value)
})
</script>

<template>
  <div class="growth">
    <!-- 页面标题已去掉，当前岗位只在有数据时占一行 -->
    <div v-if="currentPosition" class="page-toolbar">
      <div class="current-chip">
        <span class="current-chip__text">
          <span class="current-chip__label">当前岗位</span>
          <span class="current-chip__name">{{ currentPosition.name }}</span>
        </span>
        <span class="current-chip__match num">{{ currentPosition.percent }}%</span>
      </div>
    </div>

    <!-- 我的推荐岗位 -->
    <section class="panel block">
      <header class="panel-head">
        <div class="panel-head__title">
          <span class="panel-title-mark" />
          我的推荐岗位
        </div>
      </header>
      <div class="panel-body">
        <div v-if="loading" class="position-grid">
          <div v-for="index in 4" :key="index" class="position-skeleton skeleton" />
        </div>
        <div v-else-if="topPositions.length" class="position-grid">
          <PositionCard
            v-for="position in topPositions"
            :key="position.id"
            :position="position"
            @open="openPosition"
          />
        </div>
        <EmptyState
          v-else
          title="还没有推荐岗位"
          description="先完成一个基础实训项目，系统会按你的技能点进度推荐岗位。"
          action-text="去闯关地图"
          @action="router.push('/map')"
        />
      </div>
    </section>

    <!-- 实训进度概览 -->
    <section class="panel block">
      <header class="panel-head">
        <div class="panel-head__title">
          <span class="panel-title-mark" />
          实训进度概览
        </div>
        <div class="panel-head__extra">
          <div class="scope-switch">
            <button
              v-for="item in progressScopes"
              :key="item.value"
              class="scope-switch__item"
              :class="{ 'is-on': progressScope === item.value }"
              type="button"
              @click="switchScope(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </header>
      <div class="panel-body">
        <div class="tier-grid">
          <article v-for="item in tierProgress" :key="item.tier" class="tier" :class="`tier--${item.tier}`">
            <p class="tier__name">{{ item.name }}</p>
            <p class="tier__value">
              <span class="num">{{ item.done }}</span>
              <span class="tier__slash">/</span>
              <span class="num tier__total">{{ item.total }}</span>
              <span class="tier__unit">个项目已完成</span>
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- 岗位技能树抽屉 -->
    <el-drawer v-model="drawerVisible" size="480px" :with-header="true">
      <template #header>
        <div class="drawer-head">
          <span>
            <span class="drawer-head__title">{{ drawerPosition?.name }}</span>
            <span class="drawer-head__sub">
              由 {{ drawerProgress.total }} 个技能点构成 · 整体进度
              {{ drawerProgress.percent }}%
            </span>
          </span>
        </div>
      </template>

      <div class="drawer-body">
        <section v-for="group in drawerGroups" :key="group.system.id" class="drawer-group">
          <header class="drawer-group__head">
            <span class="drawer-group__dot" :style="{ background: group.system.color }" />
            <span class="drawer-group__name">{{ group.system.name }}</span>
            <span class="drawer-group__count num">
              {{ skillStore.progressOfNodes(group.nodes).percent }}%
            </span>
          </header>
          <ul class="drawer-nodes">
            <li v-for="node in group.nodes" :key="node.id">
              <button class="drawer-node" type="button" @click="goSkill(node)">
                <span class="drawer-node__name">{{ node.name }}</span>
                <span class="drawer-node__bar">
                  <span
                    class="drawer-node__bar-fill"
                    :style="{
                      width: `${skillStore.progressOf(node).percent}%`,
                      background: group.system.color,
                    }"
                  />
                </span>
                <span class="drawer-node__percent num">
                  {{ skillStore.progressOf(node).percent }}%
                </span>
              </button>
            </li>
          </ul>
        </section>

        <EmptyState
          v-if="!drawerGroups.length"
          title="该岗位暂未关联技能点"
          description="岗位与技能点的关联关系由教师端配置，配置完成后会在这里展示。"
        />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.growth {
  display: flex;
  flex-direction: column;
}

.block + .block {
  margin-top: 20px;
}

.panel-head__extra {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* —— 当前岗位 chip —— */
.current-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border: 1px solid var(--brand-100);
  border-radius: var(--r-chip);
  background: var(--brand-050);
}

.current-chip__text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.current-chip__label {
  color: var(--ink-3);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.current-chip__name {
  color: var(--ink-1);
  font-size: 13px;
  font-weight: 700;
}

.current-chip__match {
  color: var(--brand-600);
  font-size: 18px;
  font-weight: 700;
}

/* —— 岗位卡片 —— */
.position-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.position-skeleton {
  height: 208px;
  border-radius: var(--r-md);
}

/* —— 进度概览 —— */
.scope-switch {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface-2);
}

.scope-switch__item {
  padding: 5px 14px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--ink-2);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.scope-switch__item:hover {
  color: var(--brand-600);
}

.scope-switch__item.is-on {
  background: var(--surface);
  color: var(--brand-600);
  box-shadow: var(--sh-1);
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.tier {
  padding: 18px 20px;
  border-radius: var(--r-md);
  border: 1px solid transparent;
}

.tier--basic {
  background: linear-gradient(150deg, #eaf4ff, #f7fbff);
  border-color: #d3e7ff;
}

.tier--advanced {
  background: linear-gradient(150deg, #fff3e4, #fffaf4);
  border-color: #ffe0bd;
}

.tier--extended {
  background: linear-gradient(150deg, #f2eefe, #faf8ff);
  border-color: #ded4ff;
}

.tier__name {
  font-size: 15px;
  font-weight: 700;
}

.tier__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.tier__value .num {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.tier__slash,
.tier__total {
  color: var(--ink-2);
}

.tier__unit {
  margin-left: 6px;
  color: var(--ink-2);
  font-size: 12px;
}

/* —— 抽屉 —— */
.drawer-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drawer-head__title {
  display: block;
  font-size: 16px;
  font-weight: 700;
}

.drawer-head__sub {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 400;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.drawer-group__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.drawer-group__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.drawer-group__name {
  font-size: 14px;
  font-weight: 700;
}

.drawer-group__count {
  margin-left: auto;
  color: var(--ink-3);
  font-size: 12px;
}

.drawer-nodes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-node {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.drawer-node:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
}

.drawer-node__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
}

.drawer-node__bar {
  width: 96px;
  height: 4px;
  flex: none;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.drawer-node__bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
}

.drawer-node__percent {
  width: 36px;
  flex: none;
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}


</style>
