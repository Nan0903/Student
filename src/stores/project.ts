import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  applyTeacherRecheck,
  fetchHistory,
  fetchProject,
  fetchProjects,
  fetchTeacherComments,
  requestRecheck,
  submitModule as submitModuleApi,
} from '@/api/project'
import { getDrafts, setDrafts } from '@/utils/storage'
import type {
  AiReview,
  HistoryRecord,
  ModuleSubmission,
  Project,
  SubmitModulePayload,
  TeacherComment,
  TrainModule,
} from '@/types'

export type ModuleGate = 'done' | 'current' | 'locked'

export interface ModuleState {
  module: TrainModule
  gate: ModuleGate
  submission?: ModuleSubmission
}

interface DraftEntry {
  textAnswers: Record<string, string>
  files: ModuleSubmission['files']
}

const draftKey = (projectId: string, moduleId: string) => `${projectId}::${moduleId}`

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  /** projectId → 已通过关卡数 */
  const passedCount = ref<Record<string, number>>({})
  /** `${projectId}::${moduleId}` → 提交记录 */
  const submissions = ref<Record<string, ModuleSubmission>>(
    {},
  )
  const drafts = ref<Record<string, DraftEntry>>(getDrafts<Record<string, DraftEntry>>() ?? {})
  const history = ref<Record<string, HistoryRecord[]>>({})
  const comments = ref<Record<string, TeacherComment[]>>({})

  const byId = computed(() => new Map(projects.value.map((project) => [project.id, project])))

  function getProject(projectId: string): Project | null {
    return byId.value.get(projectId) ?? null
  }

  function passedOf(projectId: string): number {
    const local = passedCount.value[projectId]
    if (local !== undefined) return local
    return byId.value.get(projectId)?.levelDone ?? 0
  }

  /** 关卡状态：通过上一关后才能进入下一关 */
  function moduleStates(project: Project): ModuleState[] {
    const passed = passedOf(project.id)
    const lockedProject = project.status === 'locked'
    return project.modules.map((module, index) => {
      const submission = submissions.value[draftKey(project.id, module.id)]
      let gate: ModuleGate = 'locked'
      if (!lockedProject) {
        if (index < passed) gate = 'done'
        else if (index === passed) gate = 'current'
      }
      return { module, gate, submission }
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
    return fetchProject(projectId)
  }

  async function loadDetail(projectId: string): Promise<void> {
    const [historyList, commentList] = await Promise.all([
      fetchHistory(projectId),
      fetchTeacherComments(projectId),
    ])
    history.value = { ...history.value, [projectId]: historyList }
    comments.value = { ...comments.value, [projectId]: commentList }
  }

  /* —— 草稿 —— */
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

  /* —— 提交与判分 —— */
  function recordSubmission(payload: SubmitModulePayload, review: AiReview): void {
    const key = draftKey(payload.projectId, payload.moduleId)
    submissions.value = {
      ...submissions.value,
      [key]: {
        moduleId: payload.moduleId,
        textAnswers: payload.textAnswers,
        files: payload.files,
        status: review.reviewStatus === 'passed' ? 'passed' : 'submitted',
        submittedAt: new Date().toISOString(),
        aiReview: review,
      },
    }
  }

  async function submit(payload: SubmitModulePayload): Promise<AiReview> {
    const review = await submitModuleApi(payload)
    recordSubmission(payload, review)
    clearDraft(payload.projectId, payload.moduleId)

    const project = getProject(payload.projectId)
    if (project) {
      const done = passedOf(project.id)
      passedCount.value = { ...passedCount.value, [project.id]: Math.min(project.levelTotal, done + 1) }
      const nextDone = passedCount.value[project.id] ?? done
      project.levelDone = nextDone
      project.progress = Math.round((nextDone / project.levelTotal) * 100)
      if (nextDone >= project.levelTotal) {
        project.status = 'completed'
        project.score = review.totalScore
      } else if (project.status !== 'in_progress') {
        project.status = 'in_progress'
      }
    }
    return review
  }

  async function requestTeacherRecheck(
    projectId: string,
    moduleId: string,
    note: string,
  ): Promise<AiReview | null> {
    const key = draftKey(projectId, moduleId)
    const current = submissions.value[key]
    if (!current?.aiReview) return null
    const pending = await requestRecheck(current.aiReview)
    submissions.value = {
      ...submissions.value,
      [key]: {
        ...current,
        status: 'submitted',
        aiReview: { ...pending, suggestion: note ? `${pending.suggestion}\n异议说明：${note}` : pending.suggestion },
      },
    }
    return submissions.value[key]?.aiReview ?? null
  }

  /** 模拟教师端保存复审后的回流结果 */
  async function simulateTeacherRecheck(
    projectId: string,
    moduleId: string,
  ): Promise<AiReview | null> {
    const key = draftKey(projectId, moduleId)
    const current = submissions.value[key]
    if (!current?.aiReview) return null
    const rechecked = await applyTeacherRecheck(current.aiReview)
    submissions.value = {
      ...submissions.value,
      [key]: { ...current, status: 'passed', aiReview: rechecked },
    }
    return rechecked
  }

  function getSubmission(projectId: string, moduleId: string): ModuleSubmission | undefined {
    return submissions.value[draftKey(projectId, moduleId)]
  }

  return {
    projects,
    loading,
    loaded,
    history,
    comments,
    getProject,
    passedOf,
    moduleStates,
    currentModule,
    load,
    loadProject,
    loadDetail,
    getDraft,
    saveDraft,
    clearDraft,
    submit,
    requestTeacherRecheck,
    simulateTeacherRecheck,
    getSubmission,
    submissions,
  }
})
