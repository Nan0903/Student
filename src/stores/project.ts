import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  fetchProject,
  fetchProjects,
  loadWork as loadWorkApi,
  raiseObjection,
  saveStageAnswer,
  startWork as startWorkApi,
  submitWork as submitWorkApi,
  withdrawSubmission,
} from '@/api/project'
import { attachStageFile, detachStageFile, fetchStageFiles, uploadFile } from '@/api/file'
import { ApiError } from '@/api/http'
import { currentStudentIdOrNull } from '@/api/session'
import { composeAnswerText, parseAnswerText } from '@/utils/answer'
import { getDrafts, setDrafts } from '@/utils/storage'
import type {
  AiReview,
  HistoryRecord,
  ModuleSubmission,
  Project,
  ProjectWork,
  TeacherComment,
  TrainModule,
  UploadFile,
} from '@/types'

export type ModuleGate = 'done' | 'current' | 'locked'

export interface ModuleState {
  module: TrainModule
  gate: ModuleGate
  submission?: ModuleSubmission
}

interface DraftEntry {
  textAnswers: Record<string, string>
}

/** 草稿按「学生 + 项目 + 关卡」隔离：同一台电脑换账号登录不会串作答 */
const draftKey = (projectId: string, moduleId: string) =>
  `${currentStudentIdOrNull()}::${projectId}::${moduleId}`

/** 关卡附件的缓存键（附件存在服务器上，这里只做内存缓存） */
const stageKey = (projectId: string, moduleId: string) => `${projectId}::${moduleId}`

/**
 * 实训项目与闯关状态。
 *
 * 真实数据来自后端：项目与关卡组成走 `/projects`，闯关进度走 `/attempts`，
 * 提交与评审走 `/submissions`。草稿仍然留在本机（localStorage），点「提交本关」才落库。
 */
export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  /** projectId → 本轮闯关上下文（作答 / 提交 / 评审 / 历史 / 点评） */
  const works = ref<Record<string, ProjectWork>>({})
  const history = ref<Record<string, HistoryRecord[]>>({})
  const comments = ref<Record<string, TeacherComment[]>>({})
  /** `${projectId}::${moduleId}` → 本关已上传的附件 */
  const stageFiles = ref<Record<string, UploadFile[]>>({})
  const drafts = ref<Record<string, DraftEntry>>(getDrafts<Record<string, DraftEntry>>() ?? {})

  const byId = computed(() => new Map(projects.value.map((project) => [project.id, project])))

  function getProject(projectId: string): Project | null {
    return byId.value.get(projectId) ?? null
  }

  /**
   * 项目已通过的关卡数。
   *
   * 技能点进度口径按「项目完成度 = 已通过关卡 / 关卡总数」算（见 stores/skill.ts），
   * 后端没有逐关判分，所以这里以「已填写完成的关卡数」为准，整单提交/已完成按满关计。
   */
  function passedOf(projectId: string): number {
    const project = byId.value.get(projectId)
    if (!project) return 0
    if (project.status === 'completed' || project.status === 'submitted') return project.levelTotal
    return project.levelDone
  }

  function getWork(projectId: string): ProjectWork | null {
    return works.value[projectId] ?? null
  }

  /** 关卡状态：提交/完成 → 全部已完成；进行中 → 已填的 done、第一个未填的 current、其余 locked */
  function moduleStates(project: Project): ModuleState[] {
    const work = works.value[project.id]
    const filled = new Set(
      (work?.stages ?? []).filter((stage) => stage.isFilled).map((stage) => stage.moduleId),
    )
    const finished = work?.status === 'SUBMITTED' || work?.status === 'COMPLETED'
    let currentTaken = false

    return project.modules.map((module) => {
      let gate: ModuleGate
      if (finished || filled.has(module.id)) {
        gate = 'done'
      } else if (!currentTaken) {
        gate = 'current'
        currentTaken = true
      } else {
        gate = 'locked'
      }
      return { module, gate, submission: getSubmission(project.id, module.id) }
    })
  }

  function currentModule(project: Project): ModuleState | null {
    const states = moduleStates(project)
    return states.find((state) => state.gate === 'current') ?? states[states.length - 1] ?? null
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      projects.value = await fetchProjects()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function loadProject(projectId: string): Promise<Project | null> {
    const cached = getProject(projectId)
    if (cached) return cached
    const project = await fetchProject(projectId)
    if (project) projects.value = [...projects.value.filter((item) => item.id !== project.id), project]
    return project
  }

  /** 读取某个项目的闯关上下文；force=true 时绕过缓存重新拉 */
  async function loadWork(projectId: string, force = false): Promise<ProjectWork | null> {
    if (!force && works.value[projectId]) return works.value[projectId] ?? null
    const work = await loadWorkApi(projectId)
    works.value = { ...works.value, [projectId]: work }
    history.value = { ...history.value, [projectId]: work.history }
    comments.value = { ...comments.value, [projectId]: work.comments }
    syncProject(projectId, work)
    return work
  }

  /** 把后端进度回写到项目卡片（关卡数 / 进度 / 状态 / 得分） */
  function syncProject(projectId: string, work: ProjectWork): void {
    const project = byId.value.get(projectId)
    if (!project) return
    const filled = work.stages.filter((stage) => stage.isFilled).length
    const finished = work.status === 'SUBMITTED' || work.status === 'COMPLETED'
    project.levelDone = finished ? project.levelTotal : Math.min(filled, project.levelTotal)
    project.progress =
      project.levelTotal > 0 ? Math.round((project.levelDone / project.levelTotal) * 100) : 0
    if (work.status === 'COMPLETED') project.status = 'completed'
    else if (work.status === 'SUBMITTED') project.status = 'submitted'
    else if (work.status === 'NONE') project.status = 'not_started'
    else project.status = 'in_progress'
    if (project.status === 'completed' && work.review?.totalScore !== undefined) {
      project.score = work.review.totalScore
    }
  }

  /** 开始闯关：后端新建一轮并在每关预建作答行 */
  async function startWork(projectId: string): Promise<ProjectWork | null> {
    works.value = { ...works.value, [projectId]: await startWorkApi(projectId) }
    const work = works.value[projectId] ?? null
    if (work) {
      history.value = { ...history.value, [projectId]: work.history }
      comments.value = { ...comments.value, [projectId]: work.comments }
      syncProject(projectId, work)
    }
    return work
  }

  /* —— 草稿（本机） —— */
  function getDraft(projectId: string, moduleId: string): DraftEntry | undefined {
    return drafts.value[draftKey(projectId, moduleId)]
  }

  function saveDraft(projectId: string, moduleId: string, entry: DraftEntry): void {
    drafts.value = { ...drafts.value, [draftKey(projectId, moduleId)]: entry }
    setDrafts(drafts.value)
  }

  function clearDraft(projectId: string, moduleId: string): void {
    const next = { ...drafts.value }
    delete next[draftKey(projectId, moduleId)]
    drafts.value = next
    setDrafts(next)
  }

  /* —— 已保存的作答（后端） —— */
  function getSubmission(projectId: string, moduleId: string): ModuleSubmission | undefined {
    const work = works.value[projectId]
    const stage = work?.stages.find((item) => item.moduleId === moduleId)
    if (!stage || (!stage.isFilled && !stage.answerText.trim())) return undefined
    const review = work?.review
    return {
      moduleId,
      textAnswers: parseAnswerText(stage.answerText, stage.items, moduleId),
      files: [],
      status: stage.isFilled ? (review?.reviewStatus === 'rechecked' ? 'passed' : 'submitted') : 'draft',
      submittedAt: stage.filledAt,
      aiReview: review ?? undefined,
    }
  }

  /* —— 关卡附件（文件存在服务器上，这里只做内存缓存） —— */
  function getStageFiles(projectId: string, moduleId: string): UploadFile[] {
    return stageFiles.value[stageKey(projectId, moduleId)] ?? []
  }

  /** 读本关已挂的附件 */
  async function loadStageFiles(projectId: string, moduleId: string): Promise<UploadFile[]> {
    const work = works.value[projectId]
    const stage = work?.stages.find((item) => item.moduleId === moduleId)
    if (!work?.attemptId || !stage) return []
    const files = await fetchStageFiles(work.attemptId, stage.stageId)
    stageFiles.value = { ...stageFiles.value, [stageKey(projectId, moduleId)]: files }
    return files
  }

  /** 上传附件并挂到本关：先传文件拿台账 ID，再挂关联 */
  async function uploadStageFile(
    projectId: string,
    moduleId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<UploadFile[]> {
    const work = works.value[projectId]
    const stage = work?.stages.find((item) => item.moduleId === moduleId)
    if (!work?.attemptId || !stage) throw new Error('闯关轮次还没有准备好')
    if (work.status !== 'IN_PROGRESS') throw new ApiError(409, '本轮已提交，不能再上传附件')
    const fileAssetId = await uploadFile(file, { bizType: 'SUBMISSION', onProgress })
    await attachStageFile(work.attemptId, stage.stageId, fileAssetId)
    return loadStageFiles(projectId, moduleId)
  }

  /** 解除本关的一个附件（文件台账与磁盘文件保留） */
  async function removeStageFile(
    projectId: string,
    moduleId: string,
    fileAssetId: string,
  ): Promise<UploadFile[]> {
    const work = works.value[projectId]
    const stage = work?.stages.find((item) => item.moduleId === moduleId)
    if (!work?.attemptId || !stage) throw new Error('闯关轮次还没有准备好')
    await detachStageFile(work.attemptId, stage.stageId, fileAssetId)
    return loadStageFiles(projectId, moduleId)
  }

  /** 把某一关的作答落库：多题按「【标题】+ 内容」拼成一段文本 */
  async function saveStage(projectId: string, moduleId: string): Promise<void> {
    const work = works.value[projectId]
    const project = byId.value.get(projectId)
    const stage = work?.stages.find((item) => item.moduleId === moduleId)
    const module = project?.modules.find((item) => item.id === moduleId)
    if (!work?.attemptId || !stage || !module) throw new Error('闯关轮次还没有准备好')
    if (work.status !== 'IN_PROGRESS') throw new ApiError(409, '本轮已提交，不能再修改作答')

    const draft = drafts.value[draftKey(projectId, moduleId)]
    const textAnswers =
      draft?.textAnswers ?? parseAnswerText(stage.answerText, stage.items, moduleId)
    const items = stage.items.length > 0 ? stage.items : module.questions.map((q) => ({ title: q.label, prompt: q.placeholder }))
    const answerText = composeAnswerText(items, textAnswers, moduleId)

    await saveStageAnswer({
      attemptId: work.attemptId,
      stageId: stage.stageId,
      answerText,
      isFilled: answerText.trim().length > 0,
    })
    clearDraft(projectId, moduleId)
    await loadWork(projectId, true)
  }

  /** 其余关卡的本地草稿一起落库，避免学生忘了点保存导致整单提交失败 */
  async function flushDrafts(projectId: string): Promise<void> {
    const project = byId.value.get(projectId)
    if (!project) return
    for (const module of project.modules) {
      const draft = drafts.value[draftKey(projectId, module.id)]
      if (!draft) continue
      const hasContent = Object.values(draft.textAnswers).some((value) => value.trim().length > 0)
      if (!hasContent) continue
      try {
        await saveStage(projectId, module.id)
      } catch (error) {
        // 已提交的轮次不允许改：忽略这一关，交给整单提交去校验
        if (!(error instanceof ApiError) || error.code !== 409) throw error
      }
    }
  }

  /**
   * 提交本关：先保存作答，必填关卡全部填完时自动整单提交。
   * 返回用于判分面板展示的结果（AI 判分未接入时是「已保存 / 待评审」）。
   */
  async function submitStage(projectId: string, moduleId: string): Promise<AiReview> {
    await saveStage(projectId, moduleId)
    await flushDrafts(projectId)

    let work = works.value[projectId]
    if (!work?.attemptId) throw new Error('闯关轮次还没有准备好')

    const missing = work.stages.filter((stage) => stage.required && !stage.isFilled)
    if (missing.length === 0 && work.status === 'IN_PROGRESS') {
      await submitWorkApi(work.attemptId)
      await loadWork(projectId, true)
      work = works.value[projectId]
      if (work?.review) return work.review
    }

    const stage = work?.stages.find((item) => item.moduleId === moduleId)
    const remaining = work ? work.stages.filter((item) => item.required && !item.isFilled).length : 0
    return {
      dimensions: [],
      reviewStatus: 'saved',
      suggestion: stage?.isFilled
        ? `本关作答已保存到服务器，还有 ${remaining} 个必填关卡未完成。AI 判分尚未接入，全部关卡完成后会自动整单提交。`
        : undefined,
    }
  }

  /** 撤回本次整单提交（回到可编辑） */
  async function withdraw(projectId: string): Promise<void> {
    const work = works.value[projectId]
    if (!work?.submissionId) return
    await withdrawSubmission(work.submissionId)
    await loadWork(projectId, true)
  }

  /** 对评审结果提异议（转教师复核） */
  async function requestRecheck(projectId: string, note: string): Promise<AiReview | null> {
    const work = works.value[projectId]
    if (!work?.submissionId) throw new ApiError(409, '还没有可提异议的提交记录')
    await raiseObjection(work.submissionId, note.trim() || '申请教师人工复核')
    await loadWork(projectId, true)
    return works.value[projectId]?.review ?? null
  }

  return {
    projects,
    loading,
    loaded,
    works,
    history,
    comments,
    getProject,
    passedOf,
    getWork,
    moduleStates,
    currentModule,
    load,
    loadProject,
    loadWork,
    startWork,
    getDraft,
    saveDraft,
    clearDraft,
    getSubmission,
    stageFiles,
    getStageFiles,
    loadStageFiles,
    uploadStageFile,
    removeStageFile,
    saveStage,
    submitStage,
    withdraw,
    requestRecheck,
  }
})
