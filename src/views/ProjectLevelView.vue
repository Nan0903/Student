<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AiReviewPanel from '@/components/AiReviewPanel.vue'
import EmptyState from '@/components/EmptyState.vue'
import LevelStepper from '@/components/LevelStepper.vue'
import { useChatStore } from '@/stores/chat'
import { usePositionStore } from '@/stores/position'
import { useProjectStore } from '@/stores/project'
import { formatFileSize, localId, tierLabel } from '@/utils/format'
import type { AiReview, UploadFile } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const positionStore = usePositionStore()
const chat = useChatStore()

const projectId = computed(() => String(route.params.projectId ?? ''))
const project = computed(() => projectStore.getProject(projectId.value))
const states = computed(() => (project.value ? projectStore.moduleStates(project.value) : []))

const activeModuleId = ref('')
const answers = ref<Record<string, string>>({})
const files = ref<UploadFile[]>([])
const progress = ref<Record<string, number>>({})

const reviewVisible = ref(false)
const reviewing = ref(false)
const review = ref<AiReview | null>(null)
const reviewModuleName = ref('')

const position = computed(() =>
  positionStore.positions.find((item) => item.id === project.value?.positionId),
)

const activeState = computed(
  () => states.value.find((state) => state.module.id === activeModuleId.value) ?? null,
)
const activeModule = computed(() => activeState.value?.module ?? null)
const activeGate = computed(() => activeState.value?.gate ?? 'locked')

const history = computed(() => projectStore.history[projectId.value] ?? [])
const comments = computed(() => projectStore.comments[projectId.value] ?? [])

/** 必填校验：文本题必填，报告上传关必须带附件 */
const missingFields = computed(() => {
  const module = activeModule.value
  if (!module) return []
  const missing: string[] = []
  for (const question of module.questions) {
    if (question.required && !(answers.value[question.id] ?? '').trim()) {
      missing.push(question.label)
    }
  }
  if (module.name === '报告上传' && files.value.length === 0) {
    missing.push('实训报告附件')
  }
  return missing
})

const canSubmit = computed(
  () => Boolean(activeModule.value) && missingFields.value.length === 0 && !reviewing.value,
)

let draftTimer = 0

function hydrate(moduleId: string): void {
  const submission = projectStore.getSubmission(projectId.value, moduleId)
  const draft = projectStore.getDraft(projectId.value, moduleId)
  const source = submission ?? draft
  answers.value = source ? { ...source.textAnswers } : {}
  files.value = source ? [...source.files] : []
  progress.value = {}
}

function selectModule(moduleId: string): void {
  const target = states.value.find((state) => state.module.id === moduleId)
  if (!target || target.gate === 'locked') {
    ElMessage.warning('先通过上一关，本关才会解锁')
    return
  }
  activeModuleId.value = moduleId
  hydrate(moduleId)
}

function answerOf(id: string): string {
  return answers.value[id] ?? ''
}

function setAnswer(id: string, value: string | number): void {
  answers.value = { ...answers.value, [id]: String(value) }
}

function saveDraft(): void {
  const module = activeModule.value
  if (!module) return
  projectStore.saveDraft(projectId.value, module.id, {
    textAnswers: answers.value,
    files: files.value,
  })
  ElMessage.success('草稿已保存到本机')
}

function appendFiles(fileList: { name: string; size: number; raw?: File }[]): void {
  for (const item of fileList) {
    const entry: UploadFile = {
      id: localId('file'),
      name: item.name,
      size: item.size,
      type: item.raw?.type ?? 'file',
      uploadedAt: new Date().toISOString(),
    }
    files.value = [...files.value, entry]
    progress.value = { ...progress.value, [entry.id]: 0 }
    // 模拟上传进度（真实接口就绪后替换为上传回调）
    const step = window.setInterval(() => {
      const current = progress.value[entry.id] ?? 0
      const next = Math.min(100, current + 18)
      progress.value = { ...progress.value, [entry.id]: next }
      if (next >= 100) window.clearInterval(step)
    }, 90)
  }
}

function handleUploadChange(file: { name?: string; size?: number; raw?: File }): void {
  if (!file.name) return
  appendFiles([{ name: file.name, size: file.size ?? 0, raw: file.raw }])
}

function removeFile(id: string): void {
  files.value = files.value.filter((file) => file.id !== id)
  const next = { ...progress.value }
  delete next[id]
  progress.value = next
}

async function submit(): Promise<void> {
  const module = activeModule.value
  if (!module) return
  if (missingFields.value.length > 0) {
    ElMessage.error('还有必填内容没有完成，请按提示补齐后再提交')
    return
  }

  reviewVisible.value = true
  reviewing.value = true
  review.value = null
  reviewModuleName.value = module.name

  try {
    const result = await projectStore.submit({
      projectId: projectId.value,
      moduleId: module.id,
      textAnswers: answers.value,
      files: files.value,
    })
    review.value = result
    const moduleName = project.value?.modules.find((item) => item.id === module.id)?.name ?? ''
    const nextState = states.value.find((state) => state.gate === 'current')
    if (nextState && nextState.module.id !== module.id) {
      ElMessage.success(`「${moduleName}」已通过，下一关已解锁`)
    } else if (nextState) {
      ElMessage.success('关卡已通过')
    }
  } finally {
    reviewing.value = false
  }
}

async function applyRecheck(note: string): Promise<void> {
  const module = activeModule.value
  if (!module) return
  try {
    await ElMessageBox.confirm(
      '申请后本关状态将变为「待复审」，教师完成复审后结果会回流到这里。确认提交申请？',
      '确认申请教师复评',
      { confirmButtonText: '确认申请', cancelButtonText: '再想想', type: 'warning' },
    )
  } catch {
    return
  }
  const updated = await projectStore.requestTeacherRecheck(projectId.value, module.id, note)
  if (updated) {
    review.value = updated
    ElMessage.success('已提交复评申请，状态更新为「待复审」')
  }
}

async function simulateRecheck(): Promise<void> {
  const module = activeModule.value
  if (!module) return
  const updated = await projectStore.simulateTeacherRecheck(projectId.value, module.id)
  if (updated) {
    review.value = updated
    ElMessage.success('教师复审结果已回流')
  }
}

function goNext(): void {
  reviewVisible.value = false
  const next = states.value.find((state) => state.gate === 'current')
  if (next) selectModule(next.module.id)
}

watch(
  [answers, files],
  () => {
    const module = activeModule.value
    if (!module || activeGate.value === 'locked') return
    window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(() => {
      projectStore.saveDraft(projectId.value, module.id, {
        textAnswers: answers.value,
        files: files.value,
      })
    }, 700)
  },
  { deep: true },
)

onMounted(async () => {
  chat.contextLabel = '关卡详情 · 逐关提交实训成果'
  await Promise.all([projectStore.load(), positionStore.load()])
  const current = project.value
  if (current) {
    await projectStore.loadDetail(current.id)
    chat.contextLabel = `《${current.name}》实训 · 逐关提交与 AI 判分`
    const currentState = projectStore.currentModule(current)
    if (currentState) {
      activeModuleId.value = currentState.module.id
      hydrate(currentState.module.id)
    }
  }
})

onUnmounted(() => {
  window.clearTimeout(draftTimer)
  const module = activeModule.value
  if (module) {
    projectStore.saveDraft(projectId.value, module.id, {
      textAnswers: answers.value,
      files: files.value,
    })
  }
})
</script>

<template>
  <div v-if="project" class="project-level">
    <!-- 顶部条 -->
    <header class="topbar panel">
      <button class="back" type="button" @click="router.push('/map')">
        返回关卡地图
      </button>
      <div class="topbar__title">
        <h1 class="topbar__name">{{ project.name }}</h1>
        <p class="topbar__meta">
          {{ tierLabel[project.tier] }}
          <span class="topbar__sep">·</span>
          {{ position?.name ?? '未关联岗位' }}
        </p>
      </div>
      <div class="topbar__score">
        <span class="topbar__score-label">得分</span>
        <span class="topbar__score-value num">{{ project.score ?? '—' }}</span>
      </div>
    </header>

    <!-- 步骤条 -->
    <section class="stepper panel">
      <LevelStepper :states="states" :active-id="activeModuleId" @select="selectModule" />
    </section>

    <div class="body">
      <!-- 左侧栏 -->
      <aside class="side">
        <section class="panel side-block">
          <div class="panel-body">
            <p class="eyebrow">任务简介</p>
            <p class="side__intro">{{ project.intro }}</p>
            <div class="side__stats">
              <span>
                关卡进度
                <b class="num">{{ project.levelDone }}/{{ project.levelTotal }}</b>
              </span>
              <span v-if="project.status === 'completed'" class="side__done">已全部通过</span>
            </div>
          </div>
        </section>

        <section v-if="activeModule" class="panel side-block">
          <header class="panel-head">
            <div class="panel-head__title">
              <span class="panel-title-mark" />
              本关任务
            </div>
          </header>
          <div class="panel-body">
            <p class="side__desc">{{ activeModule.description }}</p>
            <p class="side__label">验收标准</p>
            <ul class="criteria">
              <li v-for="item in activeModule.criteria" :key="item">
                <span class="criteria__dot" />
                {{ item }}
              </li>
            </ul>
          </div>
        </section>

        <section class="panel side-block">
          <header class="panel-head">
            <div class="panel-head__title">
              <span class="panel-title-mark" />
              历史记录
            </div>
            <span class="side__hint num">{{ history.length }}</span>
          </header>
          <div class="panel-body">
            <ul v-if="history.length" class="timeline">
              <li v-for="record in history" :key="record.id" class="timeline__item">
                <span class="timeline__dot" />
                <div class="timeline__main">
                  <p class="timeline__head">
                    <span class="timeline__module">{{ record.moduleName }}</span>
                    <span class="timeline__score num">{{ record.score }}分</span>
                  </p>
                  <p class="timeline__text">{{ record.summary }}</p>
                  <p class="timeline__time num">{{ record.at }}</p>
                </div>
              </li>
            </ul>
            <p v-else class="side__empty">还没有提交记录，完成第一关后会出现在这里。</p>
          </div>
        </section>

        <section class="panel side-block">
          <header class="panel-head">
            <div class="panel-head__title">
              <span class="panel-title-mark" />
              教师点评
            </div>
          </header>
          <div class="panel-body">
            <ul v-if="comments.length" class="comments">
              <li v-for="comment in comments" :key="comment.id" class="comment">
                <p class="comment__head">
                  <span class="comment__teacher">{{ comment.teacher }}</span>
                  <span class="comment__module">{{ comment.moduleName }}</span>
                  <span class="comment__time num">{{ comment.at }}</span>
                </p>
                <p class="comment__text">{{ comment.content }}</p>
              </li>
            </ul>
            <p v-else class="side__empty">教师会在你提交后给出针对性点评。</p>
          </div>
        </section>
      </aside>

      <!-- 右侧作答区 -->
      <main class="work">
        <div v-if="!activeModule" class="panel">
          <EmptyState title="该项目暂未解锁" :description="project.lockReason ?? '完成前置项目即可解锁'" />
        </div>

        <section v-else class="panel work__panel">
          <header class="work__head">
            <div>
              <p class="eyebrow">第 {{ activeModule.order }} 关</p>
              <h2 class="work__title">{{ activeModule.name }}</h2>
              <p class="work__goal">{{ activeModule.goal }}</p>
            </div>
            <div class="work__badges">
              <span class="pill" :class="activeGate === 'done' ? 'pill--done' : 'pill--todo'">
                {{ activeGate === 'done' ? '已通过' : '进行中' }}
              </span>
              <span class="work__weight">分值占比 {{ activeModule.weight }}%</span>
            </div>
          </header>

          <div class="work__body">
            <p class="work__requirement">
              <span class="work__requirement-tag">作答要求</span>
              {{ activeModule.requirement }}
            </p>

            <article v-for="question in activeModule.questions" :key="question.id" class="question">
              <p class="question__label">
                {{ question.label }}
                <span v-if="question.required" class="question__required">必填</span>
              </p>
              <el-input
                :model-value="answerOf(question.id)"
                @update:model-value="setAnswer(question.id, $event)"
                type="textarea"
                :rows="5"
                :maxlength="question.maxLength"
                show-word-limit
                resize="none"
                :placeholder="question.placeholder"
                :disabled="activeGate === 'done'"
              />
              <p v-if="question.hint" class="question__hint">{{ question.hint }}</p>
            </article>

            <section class="upload">
              <p class="question__label">
                附件上传
                <span class="question__hint-inline">支持文本 / 图片 / PDF，单个 ≤ 50MB</span>
              </p>
              <el-upload
                v-if="activeGate !== 'done'"
                drag
                multiple
                :auto-upload="false"
                :show-file-list="false"
                :on-change="handleUploadChange"
              >
                <p class="upload__text">把文件拖到这里，或<em>点击选择文件</em></p>
                <p class="upload__hint">建议上传关键过程截图、测试数据表与实训报告</p>
              </el-upload>

              <ul v-if="files.length" class="filelist">
                <li v-for="file in files" :key="file.id" class="file">
                  <span class="file__main">
                    <span class="file__name">{{ file.name }}</span>
                    <span class="file__meta num">{{ formatFileSize(file.size) }}</span>
                  </span>
                  <span class="file__progress">
                    <el-progress
                      :percentage="progress[file.id] ?? 100"
                      :stroke-width="4"
                      :show-text="false"
                      :status="(progress[file.id] ?? 100) >= 100 ? 'success' : ''"
                    />
                  </span>
                  <button
                    v-if="activeGate !== 'done'"
                    class="file__remove"
                    type="button"
                    title="删除"
                    @click="removeFile(file.id)"
                  >
                    删除
                  </button>
                </li>
              </ul>
            </section>

            <div v-if="missingFields.length" class="work__warn">
              还差 {{ missingFields.length }} 项必填内容：{{ missingFields.join('、') }}
            </div>
          </div>

          <footer class="work__foot">
            <el-button @click="saveDraft">保存草稿</el-button>
            <el-button
              v-if="activeGate === 'done'"
              type="primary"
              @click="reviewVisible = true"
            >
              查看上次评判
            </el-button>
            <el-button type="primary" :disabled="!canSubmit" :loading="reviewing" @click="submit">
              提交本关
            </el-button>
          </footer>
        </section>
      </main>
    </div>

    <!-- AI 判分结果 -->
    <el-dialog v-model="reviewVisible" width="640px" align-center :show-close="!reviewing">
      <template #header>
        <div class="review-dialog__head">
          <span class="review-dialog__title">AI 自动评判结果</span>
          <span class="review-dialog__sub">{{ project.name }} · {{ reviewModuleName }}</span>
        </div>
      </template>

      <div v-if="reviewing" class="judging">
        <span class="judging__ring" aria-hidden="true" />
        <p class="judging__title">AI 正在评判你的作答…</p>
        <p class="judging__desc">正在比对验收标准与评分维度，通常需要 1–2 秒</p>
      </div>

      <AiReviewPanel
        v-else-if="review"
        :review="review"
        :module-name="reviewModuleName"
        :project-name="project.name"
        @back="goNext"
        @recheck="applyRecheck"
        @simulate="simulateRecheck"
      />
    </el-dialog>
  </div>

  <div v-else class="panel">
    <EmptyState
      title="没有找到这个实训项目"
      description="项目可能已被教师端下架，或链接不正确。"
      action-text="返回关卡地图"
      @action="router.push('/map')"
    />
  </div>
</template>

<style scoped>
.project-level {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* —— 顶部条 —— */
.topbar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px 22px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.back:hover {
  border-color: var(--brand-300);
  color: var(--brand-600);
}

.topbar__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.topbar__name {
  font-size: 19px;
  font-weight: 700;
}

.topbar__meta {
  color: var(--ink-3);
  font-size: 12.5px;
}

.topbar__sep {
  margin: 0 6px;
}

.topbar__score {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-left: auto;
  padding: 6px 18px;
  border-radius: var(--r-md);
  background: var(--brand-050);
}

.topbar__score-label {
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.topbar__score-value {
  color: var(--brand-600);
  font-size: 26px;
  font-weight: 700;
}

/* —— 步骤条 —— */
.stepper {
  padding: 12px 18px;
}

/* —— 两栏 —— */
.body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.side-block {
  overflow: hidden;
}

.side__intro {
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.75;
}

.side__stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
  color: var(--ink-2);
  font-size: 12.5px;
}

.side__stats b {
  color: var(--ink-1);
  font-size: 15px;
}

.side__done {
  color: #2f8a08;
  font-weight: 600;
}

.side__desc {
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.7;
}

.side__label {
  margin: 14px 0 8px;
  color: var(--ink-3);
  font-size: 11px;
  letter-spacing: 0.12em;
}

.criteria {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.criteria li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.6;
}

.criteria__dot {
  width: 5px;
  height: 5px;
  margin-top: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--brand-400);
}

.side__hint {
  color: var(--ink-3);
  font-size: 12px;
}

.side__empty {
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.7;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.timeline__item {
  position: relative;
  display: flex;
  gap: 12px;
  padding-left: 4px;
}

.timeline__dot {
  position: relative;
  width: 9px;
  height: 9px;
  margin-top: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--brand-500);
  box-shadow: 0 0 0 3px var(--brand-100);
}

.timeline__item:not(:last-child) .timeline__dot::after {
  content: "";
  position: absolute;
  top: 14px;
  left: 4px;
  width: 1px;
  height: calc(100% + 6px);
  background: var(--line);
}

.timeline__main {
  min-width: 0;
}

.timeline__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.timeline__module {
  font-size: 13px;
  font-weight: 700;
}

.timeline__score {
  color: var(--ok);
  font-size: 13px;
  font-weight: 700;
}

.timeline__text {
  margin-top: 2px;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.6;
}

.timeline__time {
  margin-top: 2px;
  color: var(--ink-3);
  font-size: 11.5px;
}

.comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment {
  padding: 12px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
}

.comment__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.comment__teacher {
  font-size: 12.5px;
  font-weight: 700;
}

.comment__module {
  padding: 0 7px;
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-size: 11px;
  line-height: 18px;
}

.comment__time {
  margin-left: auto;
  color: var(--ink-3);
  font-size: 11px;
}

.comment__text {
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.7;
}

/* —— 作答区 —— */
.work__panel {
  overflow: hidden;
}

.work__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--line-soft);
  background: linear-gradient(180deg, var(--surface-2), #fff);
}

.work__title {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 700;
}

.work__goal {
  margin-top: 4px;
  color: var(--ink-2);
  font-size: 13px;
}

.work__badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex: none;
}

.work__weight {
  color: var(--ink-3);
  font-size: 12px;
}

.work__body {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 22px 24px;
}

.work__requirement {
  padding: 12px 14px;
  border-left: 3px solid var(--brand-500);
  border-radius: var(--r-sm);
  background: var(--brand-050);
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.7;
}

.work__requirement-tag {
  margin-right: 8px;
  color: var(--brand-600);
  font-weight: 700;
}

.question {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question__label {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.6;
}

.question__required {
  margin-left: 8px;
  padding: 0 6px;
  border-radius: var(--r-xs);
  background: #fff1f0;
  color: var(--danger);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.question__hint {
  color: var(--ink-3);
  font-size: 12px;
}

.question__hint-inline {
  margin-left: 8px;
  color: var(--ink-3);
  font-size: 11.5px;
  font-weight: 400;
}

.upload {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 去掉上传区图标后收紧内边距，避免中间空一大块 */
.upload :deep(.el-upload-dragger) {
  padding: 22px 20px;
  border-radius: var(--r-chip);
}

.upload__text {
  color: var(--ink-2);
  font-size: 13.5px;
}

.upload__text em {
  color: var(--brand-600);
  font-style: normal;
  font-weight: 600;
}

.upload__hint {
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 11.5px;
}

.filelist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface-2);
}

.file__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file__name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file__meta {
  color: var(--ink-3);
  font-size: 11.5px;
}

.file__progress {
  flex: 1;
  min-width: 80px;
}

.file__remove {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: var(--ink-3);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.file__remove:hover {
  background: #fff1f0;
  color: var(--danger);
}

.work__warn {
  padding: 10px 14px;
  border-radius: var(--r-sm);
  background: #fff7e6;
  color: #b35c00;
  font-size: 12.5px;
  line-height: 1.6;
}

.work__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--line-soft);
  background: var(--surface-2);
}

/* —— 判分中 —— */
.judging {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 44px 20px;
  text-align: center;
}

.judging__ring {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 3px solid var(--wip-line);
  border-top-color: var(--wip);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.judging__title {
  font-size: 15px;
  font-weight: 700;
}

.judging__desc {
  color: var(--ink-3);
  font-size: 12.5px;
}

.review-dialog__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.review-dialog__title {
  font-size: 16px;
  font-weight: 700;
}

.review-dialog__sub {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 400;
}

@media (max-width: 1280px) {
  .body {
    grid-template-columns: 280px minmax(0, 1fr);
  }
}
</style>
