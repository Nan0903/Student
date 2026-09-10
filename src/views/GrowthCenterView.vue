<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageTitle from '@/components/PageTitle.vue'
import PositionCard from '@/components/PositionCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useChatStore } from '@/stores/chat'
import { usePositionStore } from '@/stores/position'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import { tierLabel, tierOrder, tierSubtitle } from '@/utils/format'
import type { Position, SkillNode } from '@/types'

const router = useRouter()
const positionStore = usePositionStore()
const skillStore = useSkillStore()
const projectStore = useProjectStore()
const chat = useChatStore()

const drawerVisible = ref(false)
const drawerPosition = ref<Position | null>(null)

const loading = computed(() => positionStore.loading || skillStore.loading || projectStore.loading)
const topPositions = computed(() => positionStore.rankedPositions.slice(0, 4))
const currentPosition = computed(() => positionStore.currentPosition)

/** 岗位 → 关联实训项目 → 技能节点，按体系分组 */
const drawerGroups = computed(() => {
  const position = drawerPosition.value
  if (!position) return []
  const projectIds = projectStore.projects
    .filter((project) => project.positionId === position.id)
    .map((project) => project.id)
  const nodes = skillStore.nodesByProject(projectIds)
  return skillStore.systems
    .map((system) => ({
      system,
      nodes: nodes.filter((node) => node.systemId === system.id),
    }))
    .filter((group) => group.nodes.length > 0)
})

/** 实训进度概览：按层级统计已完成 / 总数 */
const tierProgress = computed(() =>
  tierOrder.map((tier) => {
    const list = projectStore.projects.filter((project) => project.tier === tier)
    return {
      tier,
      name: tierLabel[tier],
      subtitle: tierSubtitle[tier],
      done: list.filter((project) => project.status === 'completed').length,
      total: list.length,
    }
  }),
)

function openPosition(position: Position): void {
  drawerPosition.value = position
  drawerVisible.value = true
}

/** 未点亮的技能 → 关卡地图，并带上岗位与技能筛选参数 */
function goSkill(node: SkillNode): void {
  if (node.status !== 'locked') {
    ElMessage.info(`「${node.name}」已点亮，可进入实训复习`)
  }
  drawerVisible.value = false
  void router.push({
    path: '/map',
    query: { position: drawerPosition.value?.id ?? '', skill: node.id },
  })
}

function nodeClasses(node: SkillNode): string {
  if (node.status === 'mastered') return 'is-mastered'
  if (node.status === 'active') return 'is-active'
  return 'is-locked'
}

onMounted(async () => {
  chat.contextLabel = '成长中心 · 我的岗位与实训进度'
  await Promise.all([positionStore.load(), skillStore.load(), projectStore.load()])
})
</script>

<template>
  <div class="growth">
    <PageTitle
      eyebrow="Growth Center"
      title="成长中心"
      subtitle="先看清自己在哪，再决定今天闯哪一关。"
    >
      <template #extra>
        <div v-if="currentPosition" class="current-chip">
          <span class="current-chip__icon" aria-hidden="true">{{ currentPosition.icon }}</span>
          <span class="current-chip__text">
            <span class="current-chip__label">当前岗位</span>
            <span class="current-chip__name">{{ currentPosition.name }}</span>
          </span>
          <span class="current-chip__match num">{{ currentPosition.matchRate }}%</span>
        </div>
      </template>
    </PageTitle>

    <!-- 我的岗位 -->
    <section class="panel block">
      <header class="panel-head">
        <div class="panel-head__title">
          <span class="panel-title-mark" />
          我的岗位
        </div>
        <div class="panel-head__extra">
          <span class="hint">按已点亮技能数自动排序</span>
          <el-button text type="primary" @click="router.push('/positions')">
            查看全部岗位 →
          </el-button>
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
          icon="🎯"
          title="还没有推荐岗位"
          description="先完成一个基础实训项目，系统会按你的技能点亮情况推荐岗位。"
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
        <span class="hint">按实训层级统计已完成项目</span>
      </header>
      <div class="panel-body">
        <div class="tier-grid">
          <article v-for="item in tierProgress" :key="item.tier" class="tier" :class="`tier--${item.tier}`">
            <p class="tier__name">{{ item.name }}</p>
            <p class="tier__sub">{{ item.subtitle }}</p>
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
          <span class="drawer-head__icon" aria-hidden="true">{{ drawerPosition?.icon }}</span>
          <span>
            <span class="drawer-head__title">{{ drawerPosition?.name }}</span>
            <span class="drawer-head__sub">岗位技能树 · 灰色节点点击可前往实训</span>
          </span>
        </div>
      </template>

      <div class="drawer-body">
        <section v-for="group in drawerGroups" :key="group.system.id" class="drawer-group">
          <header class="drawer-group__head">
            <span class="drawer-group__dot" :style="{ background: group.system.color }" />
            <span class="drawer-group__name">{{ group.system.name }}</span>
            <span class="drawer-group__count num">
              {{ group.nodes.filter((node) => node.status !== 'locked').length }}/{{ group.nodes.length }}
            </span>
          </header>
          <ul class="drawer-nodes">
            <li v-for="node in group.nodes" :key="node.id">
              <button
                class="drawer-node"
                :class="nodeClasses(node)"
                type="button"
                @click="goSkill(node)"
              >
                <span class="drawer-node__icon" aria-hidden="true">{{ node.icon }}</span>
                <span class="drawer-node__name">{{ node.name }}</span>
                <span class="drawer-node__state">
                  <template v-if="node.status === 'mastered'">已精通</template>
                  <template v-else-if="node.status === 'active'">
                    点亮中 <span class="num">{{ node.progress.current }}/{{ node.progress.total }}</span>
                  </template>
                  <template v-else>未解锁</template>
                </span>
              </button>
            </li>
          </ul>
        </section>

        <EmptyState
          v-if="!drawerGroups.length"
          icon="🌱"
          title="该岗位暂无关联技能节点"
          description="技能体系由教师端配置，配置完成后会在这里展示。"
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

.hint {
  color: var(--ink-3);
  font-size: 12px;
}

/* —— 当前岗位 chip —— */
.current-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border: 1px solid var(--brand-100);
  border-radius: var(--r-pill);
  background: var(--brand-050);
}

.current-chip__icon {
  font-size: 20px;
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

.tier__sub {
  margin-bottom: 12px;
  color: var(--ink-2);
  font-size: 12px;
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

.drawer-head__icon {
  font-size: 22px;
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

.drawer-node__icon {
  font-size: 18px;
}

.drawer-node__name {
  font-size: 13px;
  font-weight: 600;
}

.drawer-node__state {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--ink-3);
}

.drawer-node.is-mastered .drawer-node__state {
  color: #2f8a08;
  font-weight: 600;
}

.drawer-node.is-active .drawer-node__state {
  color: var(--brand-600);
  font-weight: 600;
}

.drawer-node.is-locked {
  background: var(--lock-bg);
  border-color: var(--lock-line);
}

.drawer-node.is-locked .drawer-node__icon,
.drawer-node.is-locked .drawer-node__name {
  color: var(--ink-3);
  filter: grayscale(0.6);
}


</style>
