<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Graph } from '@antv/g6'
import type { EdgeData, GraphData, NodeData } from '@antv/g6'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/PageTitle.vue'
import { platformInfo } from '@/config/nav'
import { useChatStore } from '@/stores/chat'
import { useProjectStore } from '@/stores/project'
import { useSkillStore } from '@/stores/skill'
import type { SkillNode as SkillNodeType } from '@/types'

const router = useRouter()
const skillStore = useSkillStore()
const projectStore = useProjectStore()
const chat = useChatStore()

const detailVisible = ref(false)
const activeNode = ref<SkillNodeType | null>(null)
const activeSystemName = ref('')
const activeColor = ref('#1e7be8')
const graphInstance = shallowRef<Graph | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)
/** 画布高度：按内容等比算出来，内容超高时由外层容器上下滚动 */
const graphHeight = ref(420)
const MIN_GRAPH_H = 380
/** 图形首帧渲染完成前先盖一层骨架，避免看到"半成品"再跳一下 */
const graphReady = ref(false)

const systems = computed(() => skillStore.systems)
const stats = computed(() => skillStore.stats)
/** 当前节点的进度与挂靠项目（技能点 ↔ 项目是多对多） */
const activeProgress = computed(() =>
  activeNode.value ? skillStore.progressOf(activeNode.value) : null,
)

const relatedProjects = computed(() =>
  activeNode.value ? skillStore.projectsOfNode(activeNode.value.id) : [],
)

/** 待补的优先：跳去完成度最低的那个项目 */
const practiceProject = computed(() => {
  const list = relatedProjects.value
  if (!list.length) return null
  return [...list].sort((a, b) => skillStore.projectPercent(a) - skillStore.projectPercent(b))[0]
})

/* -------------------------------------------------------------------------- */
/* AntV G6 技能树                                                             */
/* 排布规则：体系在顶，向下每行固定两个技能点（左右各一个）——                    */
/* 第一行从体系节点左右分叉，同一列的技能点纵向相连；技能点之间没有先后顺序，      */
/* 所以不打序号、连线也不带箭头。                                              */
/* -------------------------------------------------------------------------- */

const SKILL_W = 172
const SKILL_H = 86
/** 左右两列之间的间距 */
const COL_GAP = 32
/** 每行之间的间距 */
const ROW_GAP = 34
/** 体系与体系之间的间距 */
const SYSTEM_GAP = 56
const SYSTEM_W = 184
const SYSTEM_H = 56
/** 画布内边距，与 Graph 的 padding 保持一致 */
const PADDING = 14

const systemNodeId = (systemId: string) => `sys::${systemId}`

/**
 * 技能点卡片：名称 + 进度条 + 百分比 + 关联项目的完成情况。
 * 技能点之间没有先后顺序，所以不打序号、也没有前置关系。
 */
function skillCardHtml(node: SkillNodeType, percent: number, done: number, total: number): string {
  const projectText = total ? `${done}/${total}` : '—'
  return `
    <div class="skill-node">
      <div class="skill-node__top">
        <span class="skill-node__name">${node.name}</span>
        <span class="skill-node__pct">${percent}%</span>
      </div>
      <div class="skill-node__bar"><i style="width:${percent}%"></i></div>
      <div class="skill-node__meta">项目进度 <span class="num">${projectText}</span></div>
    </div>
  `
}

/** 体系卡片：名称 + 总进度 */
function systemCardHtml(name: string, percent: number, done: number, total: number): string {
  return `
    <div class="tree-system">
      <div class="tree-system__top">
        <span class="tree-system__name">${name}</span>
        <span class="tree-system__pct">${percent}%</span>
      </div>
      <div class="tree-system__bar"><i style="width:${percent}%"></i></div>
      <div class="tree-system__meta">已完成 ${done}/${total}</div>
    </div>
  `
}

function buildGraphData(): GraphData {
  const nodes: NodeData[] = []
  const edges: EdgeData[] = []
  /** 一个体系占两列，宽度固定，便于四个体系等距并排 */
  const laneWidth = SKILL_W * 2 + COL_GAP
  const stepX = (SKILL_W + COL_GAP) / 2
  const stepY = SKILL_H + ROW_GAP

  systems.value.forEach((system, systemIndex) => {
    const centerX = systemIndex * (laneWidth + SYSTEM_GAP) + laneWidth / 2
    const rootId = systemNodeId(system.id)
    const progress = skillStore.systemProgress(system)

    nodes.push({
      id: rootId,
      data: { kind: 'system', systemId: system.id, color: system.color },
      style: {
        x: centerX,
        y: 0,
        size: [SYSTEM_W, SYSTEM_H],
        dx: -SYSTEM_W / 2,
        dy: -SYSTEM_H / 2,
        innerHTML: `<div class="tree-node-wrap" style="--tone:${system.color}">${systemCardHtml(
          system.name,
          progress.percent,
          progress.done,
          progress.total,
        )}</div>`,
      },
    })

    system.nodes.forEach((node, index) => {
      const progress = skillStore.progressOf(node)
      // 0 左 1 右：一行两个，左右分列
      const column = index % 2
      const row = Math.floor(index / 2)
      nodes.push({
        id: node.id,
        data: {
          kind: 'skill',
          systemId: system.id,
          color: system.color,
          name: node.name,
        },
        style: {
          x: centerX + (column === 0 ? -stepX : stepX),
          y: (row + 1) * stepY,
          size: [SKILL_W, SKILL_H],
          dx: -SKILL_W / 2,
          dy: -SKILL_H / 2,
          innerHTML: `<div class="tree-node-wrap" data-node-id="${node.id}" style="--tone:${
            system.color
          }">${skillCardHtml(
            node,
            progress.percent,
            progress.projectDone,
            progress.projectTotal,
          )}</div>`,
        },
      })

      // 第一行左右分叉连到体系，其余与本列上一行的技能点相连
      const above = index >= 2 ? system.nodes[index - 2] : undefined
      const source = above ? above.id : rootId
      edges.push({
        id: `${source}→${node.id}`,
        source,
        target: node.id,
        data: { tone: system.color, fork: index < 2 },
        style: {
          stroke: system.color,
          strokeOpacity: index < 2 ? 0.5 : 0.38,
          lineWidth: index < 2 ? 1.5 : 1.3,
        },
      })
    })
  })

  return { nodes, edges }
}

function createGraph(): void {
  const container = canvasRef.value
  if (!container) return
  graphInstance.value?.destroy()
  container.removeEventListener('click', onCanvasClick)

  const graph = new Graph({
    container,
    autoResize: true,
    padding: PADDING,
    // 渲染时就完成自适应，避免先按默认视口画一帧再"跳"到适应画布
    autoFit: 'view',
    data: buildGraphData(),
    node: { type: 'html' },
    edge: {
      type: 'polyline',
      style: {
        radius: 10,
        // 技能点之间是并列/关联关系，没有先后顺序，所以连线不画箭头
        endArrow: false,
        startArrow: false,
        router: { type: 'orth' },
      },
    },
    // 位置在 buildGraphData 里算好（每行两个 + 顶层分叉），这里不再交给布局算法
    // 不允许缩放与拖拽：画布默认适应宽度，超出高度时由外层容器上下滑动
    behaviors: [],
    // 关掉元素入场动画，进页面时直接给出完整图形
    animation: false,
  })

  graph.on('node:click', (event) => {
    const { target } = event as { target?: { id?: string; config?: { id?: string } } }
    openByNodeId(String(target?.id ?? target?.config?.id ?? ''))
  })

  // HTML 节点的 DOM 会挡住 G6 的 canvas 事件，这里用事件委托补一次
  container.addEventListener('click', onCanvasClick)

  graphInstance.value = graph
  void graph.render().then(() => {
    graphReady.value = true
  })
}

function onCanvasClick(event: MouseEvent): void {
  const wrap = (event.target as HTMLElement | null)?.closest?.('.tree-node-wrap') as
    | HTMLElement
    | null
  openByNodeId(wrap?.dataset.nodeId ?? '')
}

function openByNodeId(id: string): void {
  if (!id || id.startsWith('sys::')) return
  const node = skillStore.getNode(id)
  if (!node) return
  const system = skillStore.systems.find((item) => item.id === node.systemId)
  openDetail(node, system?.name ?? '', system?.color ?? '#1e7be8')
}

/** 图内容尺寸（图坐标）：四个体系按两列并排铺开 */
const contentSize = computed(() => {
  const lanes = Math.max(1, systems.value.length)
  const laneWidth = SKILL_W * 2 + COL_GAP
  const width = lanes * laneWidth + (lanes - 1) * SYSTEM_GAP
  const maxNodes = Math.max(1, ...systems.value.map((system) => system.nodes.length))
  const rows = Math.max(1, Math.ceil(maxNodes / 2))
  const height = rows * (SKILL_H + ROW_GAP) + (SKILL_H + SYSTEM_H) / 2
  return { width, height }
})

/** 滚动条宽度预留，避免出现滚动条后宽度来回抖动 */
const SCROLLBAR_ALLOWANCE = 10

/** 宽度铺满画布，画布高度按等比缩放后的内容高度给，内容超高就交给外层上下滑动 */
function measure(): void {
  const element = measureRef.value
  if (!element) return
  const available = element.clientWidth - SCROLLBAR_ALLOWANCE
  if (available <= 0) return
  const scale = available / contentSize.value.width
  graphHeight.value = Math.max(
    MIN_GRAPH_H,
    Math.round(contentSize.value.height * scale + PADDING * 2),
  )
}

async function fitCanvas(): Promise<void> {
  // 不做动画：容器尺寸变化时直接落到最终视口
  await graphInstance.value?.fitView({ when: 'always', direction: 'both' }, false)
}

watch(graphHeight, async () => {
  await nextTick()
  await fitCanvas()
})

/** 进度变化（例如刚提交完关卡）时只重建数据，不销毁画布 */
const progressKey = computed(() =>
  skillStore.allNodes.map((node) => `${node.id}:${skillStore.progressOf(node).percent}`).join('|'),
)
let builtKey = ''

watch(progressKey, async (key) => {
  const graph = graphInstance.value
  if (!graph || key === builtKey) return
  builtKey = key
  graph.setData(buildGraphData())
  await graph.render()
})

function openDetail(node: SkillNodeType, systemName: string, color: string): void {
  activeNode.value = node
  activeSystemName.value = systemName
  activeColor.value = color
  detailVisible.value = true
}

/** 去完成度最低的挂靠项目继续练 */
function goPractice(): void {
  const node = activeNode.value
  const target = practiceProject.value
  detailVisible.value = false
  if (!node) return
  void router.push({
    path: '/map',
    query: { skill: node.id, position: '', project: target?.id ?? '' },
  })
}

function openProject(projectId: string): void {
  detailVisible.value = false
  void router.push(`/map/project/${projectId}`)
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  chat.contextLabel = '技能树 · 查看技能成长路径'
  await Promise.all([skillStore.load(), projectStore.load()])
  await nextTick()
  builtKey = progressKey.value
  measure()
  createGraph()

  resizeObserver = new ResizeObserver(measure)
  if (measureRef.value) resizeObserver.observe(measureRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  canvasRef.value?.removeEventListener('click', onCanvasClick)
  graphInstance.value?.destroy()
  graphInstance.value = null
})
</script>

<template>
  <div class="skill-tree">
    <PageTitle
      title="技能树"
    >
      <template #extra>
        <div v-if="platformInfo.showSkillStats" class="stats">
          <div class="stats__item">
            <span class="stats__value num">{{ stats.percent }}%</span>
            <span class="stats__label">整体进度</span>
          </div>
          <div class="stats__item">
            <span class="stats__value num">{{ stats.done }}</span>
            <span class="stats__label">技能点已完成</span>
          </div>
          <div class="stats__item">
            <span class="stats__value num">{{ stats.total }}</span>
            <span class="stats__label">技能点总数</span>
          </div>
        </div>
      </template>
    </PageTitle>

    <section class="canvas">
      <header class="canvas__bar">
        <ul class="legend">
          <li v-for="system in systems" :key="system.id" class="legend__item">
            <span class="legend__dot" :style="{ background: system.color }" />
            <span class="legend__name">{{ system.name }}</span>
            <span class="legend__value num">{{ skillStore.systemProgress(system).percent }}%</span>
          </li>
        </ul>
      </header>

      <div ref="measureRef" class="canvas__body">
        <div class="canvas__scroll" :class="{ 'is-pending': !graphReady }">
          <div
            ref="canvasRef"
            class="canvas__graph"
            :style="{ height: `${graphHeight}px` }"
          />
        </div>
        <div v-if="!graphReady" class="canvas__loading">
          <div class="skeleton canvas__skeleton" />
        </div>
      </div>
    </section>

    <!-- 节点详情卡 -->
    <el-dialog v-model="detailVisible" width="480px" align-center :show-close="true">
      <template #header>
        <div class="detail-head">
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

        <div class="detail__progress">
          <div class="detail__progress-top">
            <span class="detail__progress-label">技能点进度</span>
            <span class="detail__progress-value num">{{ activeProgress?.percent ?? 0 }}%</span>
          </div>
          <div class="detail__bar">
            <span
              class="detail__bar-fill"
              :style="{ width: `${activeProgress?.percent ?? 0}%`, background: activeColor }"
            />
          </div>
          <p class="detail__progress-note">
            由 {{ activeProgress?.projectTotal ?? 0 }} 个关联项目的完成度平均得出
          </p>
        </div>

        <div class="detail__row">
          <span class="detail__row-label">关联项目</span>
          <ul v-if="relatedProjects.length" class="projects">
            <li v-for="project in relatedProjects" :key="project.id">
              <button class="project" type="button" @click="openProject(project.id)">
                <span class="project__name">{{ project.name }}</span>
                <span class="project__bar">
                  <span
                    class="project__bar-fill"
                    :style="{ width: `${skillStore.projectPercent(project)}%` }"
                  />
                </span>
                <span class="project__percent num">
                  {{ Math.round(skillStore.projectPercent(project)) }}%
                </span>
              </button>
            </li>
          </ul>
          <span v-else class="detail__muted">暂无关联项目，可联系教师端补充</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" :disabled="!practiceProject" @click="goPractice">
          去推进项目
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
  min-width: 96px;
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

/* —— 画布：浅色底 + 点阵，与站点整体色调一致 —— */
.canvas {
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background:
    radial-gradient(110% 80% at 4% 0%, rgba(30, 123, 232, 0.06), transparent 58%),
    radial-gradient(80% 70% at 98% 2%, rgba(139, 124, 255, 0.05), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, #f6faff 100%);
  box-shadow: var(--sh-1);
  overflow: hidden;
}

.canvas__bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.72);
}

.legend {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink-2);
}

.legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend__name {
  font-weight: 600;
}

.legend__value {
  color: var(--ink-3);
  font-weight: 700;
}

.canvas__body {
  position: relative;
  background-image: radial-gradient(rgba(30, 123, 232, 0.1) 1px, transparent 1px);
  background-size: 22px 22px;
}

/* 不允许缩放/拖拽，内容超过高度时这里上下滚动 */
.canvas__scroll {
  max-height: min(68vh, 640px);
  overflow-x: hidden;
  overflow-y: auto;
}

.canvas__graph {
  width: 100%;
  transition: opacity 0.22s ease;
}

/* 首帧画好之前先藏住画布，避免看到还没自适应的中间状态 */
.canvas__scroll.is-pending .canvas__graph {
  opacity: 0;
}

.canvas__loading {
  position: absolute;
  inset: 0;
  padding: 16px;
}

.canvas__skeleton {
  height: 100%;
  min-height: 320px;
  border-radius: var(--r-md);
}

/* —— 详情卡 —— */
.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
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

.detail__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail__progress-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.detail__progress-label {
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 600;
}

.detail__progress-value {
  color: var(--ink-1);
  font-size: 20px;
  font-weight: 700;
}

.detail__bar {
  height: 8px;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.detail__bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  transition: width 0.4s ease;
}

.detail__progress-note {
  color: var(--ink-3);
  font-size: 11.5px;
}

.detail__row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail__row-label {
  color: var(--ink-3);
  font-size: 12.5px;
}

.detail__muted {
  color: var(--ink-3);
  font-size: 12.5px;
}

.projects {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.project:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
}

.project__name {
  flex: 1;
  min-width: 0;
  color: var(--ink-1);
  font-size: 12.5px;
  font-weight: 600;
  text-align: left;
}

.project__bar {
  width: 84px;
  height: 4px;
  flex: none;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.project__bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  background: var(--brand-500);
}

.project__percent {
  width: 36px;
  flex: none;
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}

/* --------------------------------------------------------------------------
   G6 节点：HTML 节点挂在画布容器里，样式从这里下发（需要 :deep）
   -------------------------------------------------------------------------- */

.canvas__graph :deep(.tree-node-wrap) {
  width: 100%;
  height: 100%;
}

/* —— 技能点：方形卡片 + 进度条 —— */
.canvas__graph :deep(.skill-node) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: #fff;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.05);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  box-sizing: border-box;
}

.canvas__graph :deep(.skill-node):hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--tone) 55%, #fff);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--tone) 22%, transparent);
}

.canvas__graph :deep(.skill-node__top) {
  display: flex;
  align-items: center;
  gap: 8px;
}

.canvas__graph :deep(.skill-node__name) {
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink-1);
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.canvas__graph :deep(.skill-node__top) {
  align-items: flex-start;
}

.canvas__graph :deep(.skill-node__pct) {
  flex: none;
  color: color-mix(in srgb, var(--tone) 62%, var(--ink-1));
  font-family: var(--font-num);
  font-size: 13.5px;
  font-weight: 700;
}

.canvas__graph :deep(.skill-node__bar) {
  display: block;
  height: 5px;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.canvas__graph :deep(.skill-node__bar i) {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 55%, #fff), var(--tone));
  transition: width 0.4s ease;
}

/* 关联项目完成数：项目进度 1/3 */
.canvas__graph :deep(.skill-node__meta) {
  color: var(--ink-3);
  font-size: 11.5px;
  line-height: 1.2;
  white-space: nowrap;
}

.canvas__graph :deep(.skill-node__meta .num) {
  color: var(--ink-2);
  font-weight: 700;
}

/* —— 体系节点：矩形卡片，名称 + 总进度 —— */
.canvas__graph :deep(.tree-system) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 100%;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: #fff;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.05);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  box-sizing: border-box;
}

.canvas__graph :deep(.tree-system__top) {
  display: flex;
  align-items: center;
  gap: 8px;
}

.canvas__graph :deep(.tree-system__name) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-1);
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.28;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas__graph :deep(.tree-system__pct) {
  flex: none;
  color: color-mix(in srgb, var(--tone) 65%, var(--ink-1));
  font-family: var(--font-num);
  font-size: 13px;
  font-weight: 700;
}

.canvas__graph :deep(.tree-system__bar) {
  display: block;
  height: 5px;
  overflow: hidden;
  border-radius: var(--r-bar);
  background: var(--line-soft);
}

.canvas__graph :deep(.tree-system__bar i) {
  display: block;
  height: 100%;
  border-radius: var(--r-bar);
  background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 55%, #fff), var(--tone));
  transition: width 0.4s ease;
}

/* 体系根节点：实色描边 + 更明显的体系色 */
.canvas__graph :deep(.tree-system) {
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid color-mix(in srgb, var(--tone) 45%, #fff);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--tone) 10%, #fff),
    #fff 70%
  );
  cursor: default;
}

.canvas__graph :deep(.tree-system):hover {
  transform: none;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.05);
}

.canvas__graph :deep(.tree-system__name) {
  font-size: 14px;
  letter-spacing: 0.03em;
}

.canvas__graph :deep(.tree-system__meta) {
  color: var(--ink-3);
  font-size: 11px;
  line-height: 1;
}
</style>
