<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AiReviewPanel from '@/components/AiReviewPanel.vue'
import EmptyState from '@/components/EmptyState.vue'
import LevelStepper from '@/components/LevelStepper.vue'
import { useChatStore } from '@/stores/chat'
import { useEnumStore } from '@/stores/enums'
import { usePositionStore } from '@/stores/position'
import { useProjectStore } from '@/stores/project'
import { formatFileSize, tierLabel } from '@/utils/format'
import type { AiReview, ProjectFileKind } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const positionStore = usePositionStore()
const chat = useChatStore()
const enums = useEnumStore()

const projectId = computed(() => String(route.params.projectId ?? ''))
const project = computed(() => projectStore.getProject(projectId.value))
const states = computed(() => (project.value ? projectStore.moduleStates(project.value) : []))
const work = computed(() => projectStore.getWork(projectId.value))
/** 后端还没有这条实训记录 = 还没开始闯关 */
const notStarted = computed(() => !work.value?.attemptId)
/** 已提交 / 已完成：本轮不能再改作答 */
const readOnly = computed(
  () => work.value?.status === 'SUBMITTED' || work.value?.status === 'COMPLETED',
)

const activeModuleId = ref('')
const answers = ref<Record<string, string>>({})
/** 本关已上传到服务器的附件（后端为准，不做本地缓存） */
const files = computed(() => projectStore.getStageFiles(projectId.value, activeModuleId.value))
/** 正在上传的文件：文件名 → 进度百分比 */
const uploading = ref<Record<string, number>>({})

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

/** 项目资料：用途文案优先取后端字典（project_file_kind），图标本地维护 */
const fileKindLabel: Record<ProjectFileKind, string> = {
  REPORT_TEMPLATE: '报告模板',
  DATASET: '数据文件',
  GUIDE: '说明文档',
  OTHER: '其它',
}

function fileKindText(kind: ProjectFileKind): string {
  return enums.label('project_file_kind', kind, fileKindLabel[kind])
}

function fileIcon(kind: ProjectFileKind): string {
  switch (kind) {
    case 'REPORT_TEMPLATE':
      return '📄'
    case 'DATASET':
      return '📊'
    case 'GUIDE':
      return '📘'
    default:
      return '📎'
  }
}

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
  if (module.name.includes('报告') && files.value.length === 0) {
    missing.push('实训报告附件')
  }
  return missing
})

const canSubmit = computed(
  () =>
    Boolean(activeModule.value) &&
    !notStarted.value &&
    !readOnly.value &&
    missingFields.value.length === 0 &&
    !reviewing.value,
)

/** 顶部状态条：整单提交 / 评审完成后给学生的明确提示 */
const statusBanner = computed(() => {
  if (work.value?.status === 'SUBMITTED') {
    return {
      tone: 'wip' as const,
      text:
        work.value.submissionStatus === 'PENDING_AI'
          ? '本单已提交，AI 判分尚未接入，正在等待评审'
          : '本单已提交，正在等待教师复核',
    }
  }
  if (work.value?.status === 'COMPLETED') {
    return { tone: 'done' as const, text: `本单已通过评审，得分 ${project.value?.score ?? '—'}` }
  }
  return null
})

/** 判分弹窗标题：AI 判分未接入，按当前状态如实命名 */
const dialogTitle = computed(() => {
  switch (review.value?.reviewStatus) {
    case 'saved':
      return '本关作答已保存'
    case 'pending':
      return '整单提交结果'
    case 'pending_recheck':
      return '复评申请已提交'
    default:
      return review.value ? '评审结果' : '提交结果'
  }
})

let draftTimer = 0
/** 回填作答期间不写草稿：否则「只是翻看某一关」也会被当成学生编辑过 */
const hydrating = ref(false)

function hydrate(moduleId: string): void {
  hydrating.value = true
  const draft = projectStore.getDraft(projectId.value, moduleId)
  const submission = projectStore.getSubmission(projectId.value, moduleId)
  // 草稿代表"还没保存到服务器的改动"，优先回填
  const source = draft ?? submission
  answers.value = source ? { ...source.textAnswers } : {}
  void nextTick(() => {
    hydrating.value = false
  })
  // 附件存在服务器上，切关时单独拉一次
  void projectStore.loadStageFiles(projectId.value, moduleId)
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

/** 把当前输入落到本机草稿（保存 / 提交前调用，避免防抖还没写） */
function persistDraft(): void {
  const module = activeModule.value
  if (!module) return
  projectStore.saveDraft(projectId.value, module.id, {
    textAnswers: answers.value,
  })
}

/** 保存本关到服务器：多题按「【标题】+ 内容」拼成一段文本落库 */
async function saveCurrent(): Promise<void> {
  const module = activeModule.value
  if (!module || readOnly.value || notStarted.value) return
  persistDraft()
  try {
    await projectStore.saveStage(projectId.value, module.id)
    ElMessage.success('本关作答已保存到服务器')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败，请稍后重试')
  }
}

/** 选好文件 → 真上传到服务器并挂到本关 */
async function handleUploadChange(file: { name?: string; raw?: File }): Promise<void> {
  const module = activeModule.value
  const raw = file.raw
  if (!module || !raw) return
  const name = file.name ?? raw.name
  uploading.value = { ...uploading.value, [name]: 0 }
  try {
    await projectStore.uploadStageFile(projectId.value, module.id, raw, (percent) => {
      uploading.value = { ...uploading.value, [name]: percent }
    })
    ElMessage.success(`「${name}」已上传`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传失败，请稍后重试')
  } finally {
    const next = { ...uploading.value }
    delete next[name]
    uploading.value = next
  }
}

/** 解除本关的一个附件 */
async function removeFile(fileId: string): Promise<void> {
  const module = activeModule.value
  if (!module) return
  try {
    await projectStore.removeStageFile(projectId.value, module.id, fileId)
    ElMessage.success('附件已移除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '移除失败，请稍后重试')
  }
}

async function submit(): Promise<void> {
  const module = activeModule.value
  if (!module) return
  if (missingFields.value.length > 0) {
    ElMessage.error('还有必填内容没有完成，请按提示补齐后再提交')
    return
  }

  persistDraft()
  reviewVisible.value = true
  reviewing.value = true
  review.value = null
  reviewModuleName.value = module.name

  try {
    const result = await projectStore.submitStage(projectId.value, module.id)
    review.value = result
    if (result.reviewStatus === 'saved') {
      ElMessage.success(`「${module.name}」已保存，下一关已解锁`)
    } else {
      ElMessage.success('整单已提交，等待评审结果')
    }
  } catch (error) {
    reviewVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '提交失败，请稍后重试')
  } finally {
    reviewing.value = false
  }
}

async function applyRecheck(note: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '申请后本次提交会转入教师复核，复核完成前不能撤回。确认提交申请？',
      '确认申请教师复评',
      { confirmButtonText: '确认申请', cancelButtonText: '再想想', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const updated = await projectStore.requestRecheck(projectId.value, note)
    if (updated) review.value = updated
    ElMessage.success('已提交复评申请，等待教师复核')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '申请失败，请稍后重试')
  }
}

/** 撤回本次整单提交，回到可编辑 */
async function withdraw(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '撤回后本次提交作废，你可以继续修改作答并重新提交。确认撤回？',
      '撤回提交',
      { confirmButtonText: '确认撤回', cancelButtonText: '再想想', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await projectStore.withdraw(projectId.value)
    reviewVisible.value = false
    const module = activeModule.value
    if (module) hydrate(module.id)
    ElMessage.success('已撤回提交，可以继续修改作答')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '撤回失败，请稍后重试')
  }
}

/** 开始闯关 / 重新挑战：后端会新建一轮并预建各关作答行 */
async function startWork(): Promise<void> {
  try {
    const result = await projectStore.startWork(projectId.value)
    const first = result?.stages.find((stage) => !stage.isFilled) ?? result?.stages[0]
    if (first) {
      activeModuleId.value = first.moduleId
      hydrate(first.moduleId)
    }
    ElMessage.success('已开始闯关，逐关完成作答即可')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '开始闯关失败，请稍后重试')
  }
}

/** 已完成的关卡：回看评审结果 */
function openLastReview(): void {
  const module = activeModule.value
  if (!module) return
  const stage = work.value?.stages.find((item) => item.moduleId === module.id)
  reviewModuleName.value = module.name
  review.value =
    work.value?.review ??
    (stage?.isFilled
      ? {
          dimensions: [],
          reviewStatus: 'saved' as const,
          suggestion: '本关作答已保存，整单提交后进入评审。',
        }
      : null)
  reviewVisible.value = true
}

function goNext(): void {
  reviewVisible.value = false
  const next = states.value.find((state) => state.gate === 'current')
  if (next) selectModule(next.module.id)
}

watch(
  [answers],
  () => {
    const module = activeModule.value
    if (!module || hydrating.value || activeGate.value === 'locked' || readOnly.value) return
    window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(() => {
      projectStore.saveDraft(projectId.value, module.id, {
        textAnswers: answers.value,
      })
    }, 700)
  },
  { deep: true },
)

onMounted(async () => {
  chat.contextLabel = '关卡详情 · 逐关提交实训成果'
  await Promise.all([projectStore.load(), positionStore.load()])
  // 列表接口不带关卡组成，进详情页时补齐全量数据（关卡 + 项目资料）
  const current = (await projectStore.loadProject(projectId.value)) ?? project.value
  if (current) {
    await projectStore.loadWork(current.id)
    chat.contextLabel = `《${current.name}》实训 · 逐关提交`
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
      <div class="topbar__actions">
        <el-button v-if="work?.status === 'COMPLETED'" @click="startWork">重新挑战</el-button>
        <el-button v-if="work?.status === 'SUBMITTED'" @click="withdraw">撤回提交</el-button>
      </div>
    </header>

    <!-- 步骤条 -->
    <section class="stepper panel">
      <LevelStepper :states="states" :active-id="activeModuleId" @select="selectModule" />
    </section>

    <!-- 提交 / 评审状态 -->
    <div v-if="statusBanner" class="statusbar" :class="`statusbar--${statusBanner.tone}`">
      <span class="statusbar__dot" aria-hidden="true" />
      {{ statusBanner.text }}
    </div>

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

        <!-- 项目资料：教师端上传的报告模板 / 数据文件 -->
        <section v-if="project.files.length" class="panel side-block">
          <header class="panel-head">
            <div class="panel-head__title">
              <span class="panel-title-mark" />
              项目资料
            </div>
            <span class="side__hint num">{{ project.files.length }}</span>
          </header>
          <div class="panel-body">
            <ul class="materials">
              <li v-for="file in project.files" :key="file.id" class="material">
                <span class="material__icon" aria-hidden="true">{{ fileIcon(file.fileKind) }}</span>
                <span class="material__main">
                  <span class="material__title">{{ file.title }}</span>
                  <span class="material__meta">
                    {{ fileKindText(file.fileKind) }} · {{ formatFileSize(file.sizeBytes) }}
                  </span>
                </span>
                <a
                  class="material__action"
                  :href="file.downloadUrl"
                  target="_blank"
                  rel="noopener"
                >
                  下载
                </a>
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
        <div v-if="notStarted" class="panel">
          <EmptyState
            title="还没有开始这个项目"
            description="点击「开始闯关」后系统会为你建立本轮实训记录；之后逐关保存作答，全部关卡完成后自动整单提交。"
            action-text="开始闯关"
            @action="startWork"
          />
        </div>

        <div v-else-if="!activeModule" class="panel">
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
                :disabled="readOnly || activeGate === 'done'"
              />
              <p v-if="question.hint" class="question__hint">{{ question.hint }}</p>
            </article>

            <section class="upload">
              <p class="question__label">
                附件上传
                <span class="question__hint-inline">支持文本 / 图片 / PDF，单个 ≤ 50MB</span>
              </p>
              <el-upload
                v-if="activeGate !== 'done' && !readOnly"
                drag
                multiple
                :auto-upload="false"
                :disabled="Boolean(Object.keys(uploading).length)"
                :show-file-list="false"
                :on-change="handleUploadChange"
              >
                <p class="upload__text">把文件拖到这里，或<em>点击选择文件</em></p>
                <p class="upload__hint">
                  选好即上传到服务器并挂在本关，建议传关键过程截图、测试数据表与实训报告
                </p>
              </el-upload>

              <!-- 正在上传 -->
              <ul v-if="Object.keys(uploading).length" class="filelist">
                <li v-for="(percent, name) in uploading" :key="name" class="file">
                  <span class="file__main">
                    <span class="file__name">{{ name }}</span>
                    <span class="file__meta num">上传中 {{ percent }}%</span>
                  </span>
                  <span class="file__progress">
                    <el-progress :percentage="percent" :stroke-width="4" :show-text="false" />
                  </span>
                </li>
              </ul>

              <!-- 已挂在本关的附件（存在服务器上） -->
              <ul v-if="files.length" class="filelist">
                <li v-for="file in files" :key="file.id" class="file">
                  <span class="file__main">
                    <span class="file__name">{{ file.name }}</span>
                    <span class="file__meta num">{{ formatFileSize(file.size) }}</span>
                  </span>
                  <a
                    v-if="file.url"
                    class="file__download"
                    :href="file.url"
                    target="_blank"
                    rel="noopener"
                  >
                    下载
                  </a>
                  <button
                    v-if="activeGate !== 'done' && !readOnly"
                    class="file__remove"
                    type="button"
                    title="移除"
                    @click="removeFile(file.id)"
                  >
                    移除
                  </button>
                </li>
              </ul>

              <p v-if="!files.length && !Object.keys(uploading).length" class="upload__empty">
                {{ activeGate === 'done' || readOnly ? '本关没有上传附件' : '还没有上传附件' }}
              </p>
            </section>

            <div v-if="missingFields.length && !readOnly && !notStarted" class="work__warn">
              还差 {{ missingFields.length }} 项必填内容：{{ missingFields.join('、') }}
            </div>
          </div>

          <footer class="work__foot">
            <el-button :disabled="readOnly || notStarted" @click="saveCurrent">
              保存本关
            </el-button>
            <el-button
              v-if="activeGate === 'done'"
              type="primary"
              @click="openLastReview"
            >
              查看评判结果
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
          <span class="review-dialog__title">{{ dialogTitle }}</span>
          <span class="review-dialog__sub">{{ project.name }} · {{ reviewModuleName }}</span>
        </div>
      </template>

      <div v-if="reviewing" class="judging">
        <span class="judging__ring" aria-hidden="true" />
        <p class="judging__title">正在提交你的作答…</p>
        <p class="judging__desc">作答会保存到服务器，必填关卡全部完成后自动整单提交</p>
      </div>

      <AiReviewPanel
        v-else-if="review"
        :review="review"
        :module-name="reviewModuleName"
        :project-name="project.name"
        @back="goNext"
        @recheck="applyRecheck"
        @withdraw="withdraw"
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
  border-radius: var(--r-pill);
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
  border-radius: var(--r-pill);
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
  font-size: 13px;
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

.file__icon {
  font-size: 16px;
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

/* —— 重新挑战 / 撤回提交 —— */
.topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* —— 提交 / 评审状态条 —— */
.statusbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 0;
  padding: 10px 18px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  box-shadow: var(--sh-1);
}

.statusbar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wip);
}

.statusbar--done {
  border-color: var(--ok-line, var(--line));
  background: var(--ok-bg, var(--surface));
}

.statusbar--done .statusbar__dot {
  background: var(--ok);
}

/* —— 项目资料（教师端上传的模板/数据文件） —— */
.materials {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.material {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface);
}

.material__icon {
  font-size: 18px;
}

.material__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.material__title {
  overflow: hidden;
  color: var(--ink-1);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material__meta {
  color: var(--ink-3);
  font-size: 11.5px;
}

.material__action {
  margin-left: auto;
  flex: none;
  padding: 3px 10px;
  border: 1px solid var(--brand-100);
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.material__action:hover {
  border-color: var(--brand-300);
}

/* —— 附件：下载链接与空态 —— */
.file__download {
  flex: none;
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.upload__empty {
  margin-top: 8px;
  color: var(--ink-3);
  font-size: 12px;
}
</style>
