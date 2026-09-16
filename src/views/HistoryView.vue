/**
 * 历史记录页（路由 `/map/history`，主导航高亮仍停留在「关卡地图」）。
 *
 * 两个视图：
 * - 提交记录：按项目筛选 + 分页，展开某一行时按需加载该次提交的 AI / 教师评审；
 * - 项目闯关记录：展示每个项目的状态、关卡进度与最高分，已通过的项目可重新挑战。
 */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import {
  fetchSubmissionReviews,
  fetchSubmissions,
  type SubmissionRecord,
  type SubmissionReview,
} from '@/api/history'
import { useChatStore } from '@/stores/chat'
import { useEnumStore } from '@/stores/enums'
import { useProjectStore } from '@/stores/project'
import {
  formatDateTime,
  projectStatusEnumCode,
  projectStatusLabel,
  projectStatusTone,
} from '@/utils/format'
import type { Project, ProjectStatus, SubmissionStatus } from '@/types'

const router = useRouter()
const projectStore = useProjectStore()
const enums = useEnumStore()
const chat = useChatStore()

const tab = ref<'submissions' | 'projects'>('submissions')

/* —— 提交记录 —— */
const submissions = ref<SubmissionRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const projectFilter = ref('')
/** 当前展开的行；同一时间只展开一条，避免评审请求并发堆积 */
const expandedId = ref('')
/** 按提交 ID 缓存的评审，避免重复请求 */
const reviewsOf = ref<Record<string, SubmissionReview[]>>({})
const reviewsLoading = ref('')

/** 状态文案与配色：优先取后端 `/enums` 字典，字典不可用时回退到这里的常量 */
const STATUS_FALLBACK: Record<string, string> = {
  PENDING_AI: '待 AI 评审',
  AI_PASSED: 'AI 通过',
  AI_FAILED: 'AI 未通过',
  PENDING_REVIEW: '待复审',
  REVIEWING: '复审中',
  REVIEWED: '已复审',
  WITHDRAWN: '已撤回',
}
const STATUS_TONE: Record<string, 'todo' | 'wip' | 'done' | 'lock'> = {
  PENDING_AI: 'wip',
  AI_PASSED: 'done',
  AI_FAILED: 'lock',
  PENDING_REVIEW: 'wip',
  REVIEWING: 'wip',
  REVIEWED: 'done',
  WITHDRAWN: 'lock',
}

function statusText(status: SubmissionStatus): string {
  return enums.label('submission_status', status, STATUS_FALLBACK[status] ?? status)
}

function statusTone(status: SubmissionStatus): 'todo' | 'wip' | 'done' | 'lock' {
  return STATUS_TONE[status] ?? 'todo'
}

function projectStatusText(status: ProjectStatus): string {
  return enums.label(
    'student_project_status',
    projectStatusEnumCode[status],
    projectStatusLabel[status],
  )
}

const hasRecords = computed(() => submissions.value.length > 0)

async function loadSubmissions(): Promise<void> {
  loading.value = true
  try {
    const data = await fetchSubmissions({
      page: page.value,
      pageSize,
      projectId: projectFilter.value || undefined,
    })
    submissions.value = data.items
    total.value = data.total
    expandedId.value = ''
  } finally {
    loading.value = false
  }
}

function changePage(next: number): void {
  page.value = next
  void loadSubmissions()
}

function reload(): void {
  page.value = 1
  void loadSubmissions()
}

/** 展开 / 收起某一行；首次展开时按需拉取该次提交的评审并缓存 */
async function toggleExpand(record: SubmissionRecord): Promise<void> {
  if (expandedId.value === record.id) {
    expandedId.value = ''
    return
  }
  expandedId.value = record.id
  if (reviewsOf.value[record.id]) return
  reviewsLoading.value = record.id
  try {
    const list = await fetchSubmissionReviews(record.id)
    reviewsOf.value = { ...reviewsOf.value, [record.id]: list }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '评审记录加载失败')
  } finally {
    reviewsLoading.value = ''
  }
}

function openProject(projectId: string): void {
  void router.push(`/map/project/${projectId}`)
}

/**
 * 重新挑战项目。
 *
 * 语义：后端会新建一轮闯关（`attempt_no + 1`），历史成绩保留在最高分字段里，
 * 因此这里不做数据清理，成功后直接进入关卡详情继续作答。
 */
async function restart(project: Project): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `重新挑战「${project.name}」会新建一轮闯关，历史成绩仍按最高分保留。确认开始？`,
      '重新挑战',
      { confirmButtonText: '开始挑战', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await projectStore.startWork(project.id)
    ElMessage.success('已开始新的一轮，加油')
    openProject(project.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '开始挑战失败，请稍后重试')
  }
}

onMounted(async () => {
  chat.contextLabel = '历史记录 · 我的提交与闯关记录'
  await projectStore.load()
  await Promise.all([loadSubmissions(), enums.load()])
})
</script>

<template>
  <div class="history">
    <!-- 顶部条：返回入口 + 项目筛选 + 视图切换 -->
    <div class="history__bar">
      <button class="back" type="button" @click="router.push('/map')">返回关卡地图</button>
      <div class="history__tools">
        <el-select
          v-if="tab === 'submissions'"
          v-model="projectFilter"
          class="history__filter"
          placeholder="全部项目"
          clearable
          @change="reload"
        >
          <el-option
            v-for="item in projectStore.projects"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
        <div class="seg">
          <button
            class="seg__item"
            :class="{ 'is-on': tab === 'submissions' }"
            type="button"
            @click="tab = 'submissions'"
          >
            提交记录
          </button>
          <button
            class="seg__item"
            :class="{ 'is-on': tab === 'projects' }"
            type="button"
            @click="tab = 'projects'"
          >
            项目闯关记录
          </button>
        </div>
      </div>
    </div>

    <!-- 视图一：提交记录（分页 + 评审懒加载） -->
    <section v-if="tab === 'submissions'" class="panel">
      <div v-if="loading" class="panel-body">
        <div v-for="index in 4" :key="index" class="row-skeleton skeleton" />
      </div>

      <div v-else-if="hasRecords" class="panel-body">
        <ul class="records">
          <li v-for="row in submissions" :key="row.id" class="record">
            <div class="record__row">
              <div class="record__main">
                <p class="record__head">
                  <span class="record__project">{{ row.projectName }}</span>
                  <span class="pill" :class="`pill--${statusTone(row.status)}`">
                    {{ statusText(row.status) }}
                  </span>
                  <span v-if="row.isStarred" class="record__star">教师标星</span>
                </p>
                <p class="record__meta num">
                  第 {{ row.attemptNo }} 轮 · 第 {{ row.submitNo }} 次提交 ·
                  {{ formatDateTime(row.submittedAt) }}
                  <template v-if="row.reviewedAt">
                    · 评审完成 {{ formatDateTime(row.reviewedAt) }}
                  </template>
                </p>
                <p v-if="row.objection" class="record__objection">
                  异议说明：{{ row.objection }}
                </p>
              </div>

              <div class="record__side">
                <span class="record__score num">{{ row.totalScore ?? '—' }}</span>
                <span class="record__score-label">
                  {{ row.totalScore === undefined ? '暂无分数' : '分' }}
                </span>
                <button class="link-btn" type="button" @click="toggleExpand(row)">
                  {{ expandedId === row.id ? '收起' : '查看评审' }}
                </button>
              </div>
            </div>

            <!-- 行内展开：该次提交的 AI 自动评审与教师复审 -->
            <div v-if="expandedId === row.id" class="reviews">
              <p v-if="reviewsLoading === row.id" class="reviews__empty">正在加载评审记录…</p>
              <template v-else-if="(reviewsOf[row.id] ?? []).length">
                <article
                  v-for="review in reviewsOf[row.id]"
                  :key="review.id"
                  class="review-card"
                >
                  <p class="review-card__head">
                    <span class="review-card__kind">
                      {{ review.kind === 'AI' ? 'AI 自动评审' : '教师复审' }}
                    </span>
                    <span v-if="review.reviewer" class="review-card__who">{{ review.reviewer }}</span>
                    <span class="review-card__score num">{{ review.score ?? '—' }} 分</span>
                    <span
                      v-if="review.conclusion"
                      class="pill"
                      :class="review.conclusion === 'PASS' ? 'pill--done' : 'pill--lock'"
                    >
                      {{ enums.label('conclusion', review.conclusion, review.conclusion === 'PASS' ? '通过' : '不通过') }}
                    </span>
                    <span v-if="review.finishedAt" class="review-card__time num">
                      {{ formatDateTime(review.finishedAt) }}
                    </span>
                  </p>
                  <ul v-if="review.dimensions.length" class="review-card__dims">
                    <li v-for="dim in review.dimensions" :key="dim.name">
                      <span class="review-card__dim-name">{{ dim.name }}</span>
                      <span class="review-card__dim-score num">{{ dim.score ?? '—' }}</span>
                      <span class="review-card__dim-reason">{{ dim.reason }}</span>
                    </li>
                  </ul>
                  <p v-if="review.comment" class="review-card__comment">{{ review.comment }}</p>
                </article>
              </template>
              <p v-else class="reviews__empty">这次提交还没有评审记录（等 AI 或教师评审后出现）。</p>
            </div>
          </li>
        </ul>

        <div v-if="total > pageSize" class="pager">
          <el-pagination
            layout="prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="changePage"
          />
        </div>
      </div>

      <div v-else class="panel-body">
        <EmptyState
          title="还没有提交记录"
          description="完成一个项目的全部关卡并整单提交后，这里会出现每次提交的状态、分数与评审。"
          action-text="去关卡地图"
          @action="router.push('/map')"
        />
      </div>
    </section>

    <!-- 视图二：项目闯关记录（状态 / 关卡进度 / 最高分 / 重新挑战） -->
    <section v-else class="panel">
      <div v-if="projectStore.projects.length" class="panel-body">
        <ul class="projects">
          <li v-for="item in projectStore.projects" :key="item.id" class="project-row">
            <div class="project-row__main">
              <p class="project-row__head">
                <span class="project-row__name">{{ item.name }}</span>
                <span class="pill" :class="`pill--${projectStatusTone[item.status]}`">
                  {{ projectStatusText(item.status) }}
                </span>
              </p>
              <p class="project-row__meta num">
                关卡 {{ item.levelDone }} / {{ item.levelTotal }} · 进度 {{ item.progress }}%
                <template v-if="item.score"> · 最高分 {{ item.score }}</template>
              </p>
              <el-progress
                :percentage="item.progress"
                :stroke-width="6"
                :show-text="false"
                :color="item.status === 'completed' ? '#52c41a' : '#1677ff'"
              />
            </div>
            <div class="project-row__actions">
              <button class="link-btn" type="button" @click="openProject(item.id)">
                {{ item.status === 'completed' ? '回看记录' : '继续闯关' }}
              </button>
              <button
                v-if="item.status === 'completed'"
                class="link-btn link-btn--strong"
                type="button"
                @click="restart(item)"
              >
                重新挑战
              </button>
            </div>
          </li>
        </ul>
      </div>
      <div v-else class="panel-body">
        <EmptyState
          title="还没有可挑战的项目"
          description="教师发布实训项目后，这里会显示你的闯关进度与成绩。"
          action-text="去关卡地图"
          @action="router.push('/map')"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
}

/* —— 顶部条 —— */
.history__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.back {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease;
}

.back:hover {
  border-color: var(--brand-300);
  color: var(--brand-600);
}

.history__tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history__filter {
  width: 220px;
}

/* 分段切换 */
.seg {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
}

.seg__item {
  padding: 6px 14px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--ink-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.seg__item:hover {
  color: var(--brand-600);
}

.seg__item.is-on {
  background: var(--brand-050);
  color: var(--brand-600);
}

/* —— 提交记录 —— */
.records {
  display: flex;
  flex-direction: column;
}

.record + .record {
  border-top: 1px dashed var(--line);
}

.record__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 2px;
}

.record__main {
  min-width: 0;
}

.record__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.record__project {
  font-size: 14.5px;
  font-weight: 700;
}

.record__star {
  color: #d48806;
  font-size: 12px;
}

.record__meta {
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 12px;
}

.record__objection {
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: var(--r-chip);
  background: var(--wip-bg);
  color: #b35c00;
  font-size: 12px;
  line-height: 1.6;
}

.record__side {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: none;
}

.record__score {
  color: var(--brand-600);
  font-size: 22px;
  font-weight: 700;
}

.record__score-label {
  color: var(--ink-3);
  font-size: 12px;
}

.link-btn {
  margin-left: 10px;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}

.link-btn:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}

.link-btn--strong {
  border-color: var(--brand-100);
  background: var(--brand-050);
  color: var(--brand-600);
}

.row-skeleton {
  height: 66px;
  border-radius: var(--r-sm);
}

.row-skeleton + .row-skeleton {
  margin-top: 10px;
}

.pager {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}

/* —— 评审卡片 —— */
.reviews {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 2px 16px;
}

.reviews__empty {
  color: var(--ink-3);
  font-size: 12.5px;
}

.review-card {
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
  background: var(--surface-2);
}

.review-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.review-card__kind {
  font-size: 13px;
  font-weight: 700;
}

.review-card__who,
.review-card__time {
  color: var(--ink-3);
  font-size: 12px;
}

.review-card__score {
  color: var(--brand-600);
  font-size: 14px;
  font-weight: 700;
}

.review-card__dims {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-card__dims li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
}

.review-card__dim-name {
  flex: none;
  min-width: 88px;
  color: var(--ink-2);
  font-weight: 600;
}

.review-card__dim-score {
  flex: none;
  color: var(--brand-600);
  font-weight: 700;
}

.review-card__dim-reason {
  color: var(--ink-3);
}

.review-card__comment {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.7;
}

/* —— 项目闯关记录 —— */
.projects {
  display: flex;
  flex-direction: column;
}

.project-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 2px;
}

.project-row + .project-row {
  border-top: 1px dashed var(--line);
}

.project-row__main {
  flex: 1;
  min-width: 0;
}

.project-row__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-row__name {
  font-size: 14.5px;
  font-weight: 700;
}

.project-row__meta {
  margin: 4px 0 8px;
  color: var(--ink-3);
  font-size: 12px;
}

.project-row__actions {
  display: flex;
  align-items: center;
  flex: none;
}
</style>
