<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/PageTitle.vue'
import SkillNode from '@/components/SkillNode.vue'
import { platformInfo } from '@/config/nav'
import { useChatStore } from '@/stores/chat'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import { skillStatusLabel } from '@/utils/format'
import type { SkillNode as SkillNodeType } from '@/types'

const router = useRouter()
const skillStore = useSkillStore()
const projectStore = useProjectStore()
const chat = useChatStore()

const detailVisible = ref(false)
const activeNode = ref<SkillNodeType | null>(null)
const activeSystemName = ref('')
const activeColor = ref('#35c2ff')

const systems = computed(() => skillStore.systems)
const stats = computed(() => skillStore.stats)

const relatedProjects = computed(() => {
  const node = activeNode.value
  if (!node) return []
  return projectStore.projects.filter((project) => node.projectIds.includes(project.id))
})

const activeNodeSystemProgress = computed(() => {
  const node = activeNode.value
  if (!node) return ''
  return `${node.progress.current} / ${node.progress.total}`
})

function openDetail(node: SkillNodeType, systemName: string, color: string): void {
  activeNode.value = node
  activeSystemName.value = systemName
  activeColor.value = color
  detailVisible.value = true
}

/** 未解锁 → 前往实训；已点亮 → 复习该项目 */
function goPractice(): void {
  const node = activeNode.value
  if (!node) return
  const first = node.projectIds[0] ?? ''
  detailVisible.value = false
  void router.push({
    path: '/map',
    query: { skill: node.id, position: '', project: first },
  })
}

function openProject(projectId: string): void {
  detailVisible.value = false
  void router.push(`/map/project/${projectId}`)
}

onMounted(async () => {
  chat.contextLabel = '技能树 · 查看技能成长路径'
  await Promise.all([skillStore.load(), projectStore.load()])
})
</script>

<template>
  <div class="skill-tree">
    <PageTitle
      eyebrow="Skill Tree"
      title="技能树"
      subtitle="四大体系分列展示，点亮一个节点，就离岗位更近一步。"
    >
      <template #extra>
        <div v-if="platformInfo.showSkillStats" class="stats">
          <div class="stats__item">
            <span class="stats__value num">{{ stats.active }}</span>
            <span class="stats__label">已激活</span>
          </div>
          <div class="stats__item">
            <span class="stats__value num">{{ stats.mastered }}</span>
            <span class="stats__label">已精通</span>
          </div>
          <div class="stats__item">
            <span class="stats__value num">{{ stats.total }}</span>
            <span class="stats__label">技能总数</span>
          </div>
        </div>
      </template>
    </PageTitle>

    <div class="canvas">
      <div v-if="skillStore.loading" class="canvas__loading">
        <div v-for="index in 4" :key="index" class="column-skeleton skeleton" />
      </div>

      <div v-else class="canvas__grid">
        <section
          v-for="system in systems"
          :key="system.id"
          class="column"
          :style="{ '--tone': system.color }"
        >
          <header class="column__head">
            <span class="column__dot" />
            <h2 class="column__name">{{ system.name }}</h2>
            <span class="column__count num">{{ system.nodes.length }}</span>
          </header>

          <div class="tree">
            <span class="tree__trunk" aria-hidden="true" />
            <div
              v-for="(node, index) in system.nodes"
              :key="node.id"
              class="tree__slot"
              :class="[
                index % 2 === 0 ? 'is-left' : 'is-right',
                node.status === 'locked' ? 'is-locked' : 'is-lit',
              ]"
            >
              <SkillNode
                :node="node"
                :color="system.color"
                :is-active="activeNode?.id === node.id"
                @select="openDetail(node, system.name, system.color)"
              />
            </div>
          </div>

          <footer class="column__foot">
            <div class="column__progress">
              <span
                class="column__progress-fill"
                :style="{ width: `${skillStore.systemProgress(system).percent}%` }"
              />
            </div>
            <p class="column__progress-text">
              <span class="num">{{ skillStore.systemProgress(system).lit }}</span> /
              <span class="num">{{ skillStore.systemProgress(system).total }}</span>
              已激活
              <span class="num">（{{ skillStore.systemProgress(system).percent }}%）</span>
            </p>
          </footer>
        </section>
      </div>
    </div>

    <!-- 节点详情卡 -->
    <el-dialog v-model="detailVisible" width="440px" align-center :show-close="true">
      <template #header>
        <div class="detail-head">
          <span class="detail-head__icon" aria-hidden="true">{{ activeNode?.icon }}</span>
          <span class="detail-head__text">
            <span class="detail-head__name">{{ activeNode?.name }}</span>
            <span class="detail-head__system">
              <span class="detail-head__dot" :style="{ background: activeColor }" />
              {{ activeSystemName }}
            </span>
          </span>
        </div>
      </template>

      <div class="detail">
        <p class="detail__desc">{{ activeNode?.description }}</p>

        <dl class="detail__list">
          <div class="detail__row">
            <dt>当前状态</dt>
            <dd>
              <span
                class="pill"
                :class="
                  activeNode?.status === 'mastered'
                    ? 'pill--done'
                    : activeNode?.status === 'active'
                      ? 'pill--todo'
                      : 'pill--lock'
                "
              >
                {{ activeNode ? skillStatusLabel[activeNode.status] : '' }}
              </span>
            </dd>
          </div>
          <div class="detail__row">
            <dt>点亮进度</dt>
            <dd class="num">{{ activeNodeSystemProgress }}</dd>
          </div>
          <div class="detail__row">
            <dt>前置条件</dt>
            <dd>
              <template v-if="activeNode?.prerequisites.length">
                <span v-for="item in activeNode.prerequisites" :key="item" class="chip">{{ item }}</span>
              </template>
              <span v-else class="detail__muted">无，可直接开始</span>
            </dd>
          </div>
          <div class="detail__row">
            <dt>关联实训</dt>
            <dd>
              <button
                v-for="project in relatedProjects"
                :key="project.id"
                class="chip chip--link"
                type="button"
                @click="openProject(project.id)"
              >
                {{ project.icon }} {{ project.name }}
              </button>
              <span v-if="!relatedProjects.length" class="detail__muted">暂无关联项目</span>
            </dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <el-button round @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" round @click="goPractice">
          {{ activeNode?.status === 'locked' ? '前往实训' : '复习该项目' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.skill-tree {
  display: flex;
  flex-direction: column;
}

/* —— 统计面板 —— */
.stats {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--sh-1);
}

.stats__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 86px;
  padding: 8px 18px;
}

.stats__item + .stats__item {
  border-left: 1px solid var(--line-soft);
}

.stats__value {
  color: var(--brand-600);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.stats__label {
  color: var(--ink-3);
  font-size: 11.5px;
  letter-spacing: 0.06em;
}

/* —— 深色画布 —— */
.canvas {
  padding: 26px 20px 22px;
  border-radius: var(--r-lg);
  background:
    radial-gradient(120% 90% at 12% 0%, rgba(53, 194, 255, 0.14), transparent 55%),
    radial-gradient(100% 80% at 92% 8%, rgba(255, 123, 168, 0.12), transparent 52%),
    radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px) 0 0 / 22px 22px,
    linear-gradient(160deg, var(--night) 0%, #191928 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), var(--sh-3);
  overflow-x: auto;
}

.canvas__loading,
.canvas__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(258px, 1fr));
  gap: 18px;
  min-width: 1080px;
}

.column-skeleton {
  height: 520px;
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.06);
}

.column-skeleton::after {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

/* —— 单列 —— */
.column {
  display: flex;
  flex-direction: column;
  padding: 16px 14px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.03);
}

.column__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px 14px;
}

.column__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 10px var(--tone);
}

.column__name {
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.column__count {
  margin-left: auto;
  padding: 0 8px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.72);
  font-size: 11.5px;
  line-height: 20px;
}

/* —— 树：中央主干 + 左右挂点 —— */
.tree {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 6px;
  padding: 4px 0 12px;
}

.tree__trunk {
  position: absolute;
  top: 0;
  bottom: 8px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  border-radius: var(--r-pill);
  background: linear-gradient(180deg, transparent, var(--tone) 8%, var(--tone) 88%, transparent);
  opacity: 0.42;
}

.tree__slot {
  position: relative;
  display: flex;
  align-items: flex-start;
  width: calc(50% - 14px);
  padding: 8px 0;
}

.tree__slot.is-left {
  justify-content: flex-end;
  margin-right: auto;
}

.tree__slot.is-right {
  justify-content: flex-start;
  margin-left: auto;
}

.tree__slot::after {
  content: "";
  position: absolute;
  top: 44px;
  width: 14px;
  height: 2px;
  border-radius: var(--r-pill);
  background: var(--tone);
  opacity: 0.5;
}

.tree__slot.is-left::after {
  left: 100%;
}

.tree__slot.is-right::after {
  right: 100%;
}

.tree__slot.is-locked::after {
  background: rgba(255, 255, 255, 0.22);
  opacity: 1;
}

.tree__slot.is-locked :deep(.skill-node__box) {
  opacity: 0.9;
}

/* —— 列底部进度 —— */
.column__foot {
  padding: 12px 6px 0;
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.column__progress {
  height: 6px;
  overflow: hidden;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.1);
}

.column__progress-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--tone), color-mix(in srgb, var(--tone) 55%, #fff));
  box-shadow: 0 0 12px var(--tone);
}

.column__progress-text {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.66);
  font-size: 11.5px;
  letter-spacing: 0.02em;
}

/* —— 详情卡 —— */
.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-head__icon {
  font-size: 24px;
}

.detail-head__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-head__name {
  font-size: 17px;
  font-weight: 700;
}

.detail-head__system {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 400;
}

.detail-head__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail__desc {
  padding: 12px 14px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.7;
}

.detail__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail__row {
  display: flex;
  gap: 14px;
  font-size: 13px;
}

.detail__row dt {
  flex: none;
  width: 72px;
  color: var(--ink-3);
}

.detail__row dd {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  color: var(--ink-1);
}

.detail__muted {
  color: var(--ink-3);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  background: var(--surface-2);
  font-size: 12px;
  line-height: 20px;
}

.chip--link {
  color: var(--brand-600);
  border-color: var(--brand-100);
  background: var(--brand-050);
  cursor: pointer;
}

.chip--link:hover {
  border-color: var(--brand-300);
}
</style>
