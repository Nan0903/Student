/**
 * 实训项目、闯关作答与整单提交（对接 training_platform）。
 *
 * 后端把「项目 → 关卡（project_module）→ 作答（attempt_stage）」拆成三层：
 * - `GET /projects` / `GET /projects/{id}`：项目与关卡组成（关卡名、权重、填写引导子标题）
 * - `POST /students/{id}/projects/{id}/start`：开始闯关（新一轮 + 预生成各关作答行）
 * - `PATCH /attempts/{id}/stages/{stage_id}`：逐关保存作答
 * - `POST /attempts/{id}/submit`：整单提交（必填关卡全填完才允许）
 * - `GET /submissions/{id}` / `GET /submissions/{id}/reviews`：提交与评审结果
 *
 * AI 判分尚未接入（后端提交后只建了一条排队任务），所以提交后停在「待评审」，
 * 前端如实展示状态，不编造分数。
 */

import { answerSummary, questionId } from '@/utils/answer'
import { formatDateTime } from '@/utils/format'
import { resolveApiPath } from './file'
import { get, patch, post, toNumber, type Page } from './http'
import { requireStudentId } from './session'
import type {
  AiReview,
  AiReviewDimension,
  AiReviewStatus,
  HistoryRecord,
  Project,
  ProjectFile,
  ProjectStatus,
  ProjectWork,
  StageAnswer,
  StageGuideItem,
  SubmissionStatus,
  TeacherComment,
  TrainModule,
  TrainQuestion,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* 后端响应结构                                                                */
/* -------------------------------------------------------------------------- */

interface BackendProjectBase {
  id: number
  project_name: string
  project_level: string
  difficulty: number
  job_id: number | null
  description: string | null
  status: string
}

interface BackendItemsJson {
  title: string
  prompt?: string | null
}

interface BackendProjectModule {
  id: number
  stage_no: number
  stage_key: string
  stage_name: string
  required: boolean
  weight: string | number
  requirement: string | null
  accept_standard: string | null
  items_json: BackendItemsJson[] | null
}

interface BackendProjectDetail extends BackendProjectBase {
  modules: BackendProjectModule[]
  files?: BackendProjectFile[]
}

interface BackendProjectFile {
  id: number
  file_kind: string
  title: string | null
  remark: string | null
  original_name: string
  content_type: string | null
  size_bytes: number
  download_url: string
}

interface BackendStageTemplate {
  id: number
  stage_key: string
  stage_name: string
  description: string | null
}

interface BackendAttemptBrief {
  id: number
  attempt_no: number
  status: string
  filled_stage_count: number
}

interface BackendStudentProjectDetail {
  id: number
  project_id: number
  status: string
  progress: string | number
  total_score: string | number | null
  best_score: string | number | null
  completed_score: string | number | null
  attempts: BackendAttemptBrief[]
}

interface BackendAttemptStage {
  id: number
  project_module_id: number
  is_filled: boolean
  answer_text: string | null
  filled_at: string | null
  stage_no: number
  stage_name: string | null
  required: boolean
  weight: string | number
  items_json: BackendItemsJson[] | null
  file_count: number
}

interface BackendAttemptDetail extends BackendAttemptBrief {
  stages: BackendAttemptStage[]
}

interface BackendSubmission {
  id: number
  attempt_id: number
  status: string
  final_conclusion: string | null
  total_score: string | number | null
  objection_reason: string | null
}

interface BackendReview {
  id: number
  review_kind: string
  status: string
  reviewer_id: number | null
  total_score: string | number | null
  comment: string | null
  dimension_json: {
    name: string
    score?: string | number | null
    weight?: string | number | null
    reason?: string | null
  }[]
  finished_at: string | null
  created_at: string
}

/* -------------------------------------------------------------------------- */
/* 映射工具                                                                    */
/* -------------------------------------------------------------------------- */

const TIER_BY_LEVEL: Record<string, Project['tier']> = {
  BASIC: 'basic',
  ADVANCED: 'advanced',
  EXPANDED: 'extended',
}

/** 项目挂靠的技能点（后端：/projects/{id}/skills） */
interface BackendProjectSkillRef {
  id: number
}

function toProjectStatus(status: string): ProjectStatus {
  switch (status) {
    case 'IN_PROGRESS':
      return 'in_progress'
    case 'SUBMITTED':
      return 'submitted'
    case 'COMPLETED':
      return 'completed'
    default:
      return 'not_started'
  }
}

function toReviewStatus(status: string): AiReviewStatus {
  switch (status) {
    case 'AI_PASSED':
      return 'passed'
    case 'AI_FAILED':
      return 'failed'
    case 'PENDING_REVIEW':
    case 'REVIEWING':
      return 'pending_recheck'
    case 'REVIEWED':
      return 'rechecked'
    case 'WITHDRAWN':
      return 'saved'
    default:
      return 'pending'
  }
}

function gradeOf(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 60) return '合格'
  return '待提高'
}

function latestAttempt(record: BackendStudentProjectDetail | null): BackendAttemptBrief | null {
  const list = record?.attempts ?? []
  if (list.length === 0) return null
  return list.reduce((latest, item) => (item.attempt_no > latest.attempt_no ? item : latest))
}

function guideItems(items: BackendItemsJson[] | null): StageGuideItem[] {
  return (items ?? []).map((item) => ({ title: item.title, prompt: item.prompt ?? '' }))
}

/**
 * 关卡 → 前端 TrainModule。
 *
 * 后端一个关卡只有一段 `requirement` + 若干「填写引导子标题」，没有逐题题干，
 * 所以这里按 items_json 生成逐题输入框（真要多题结构化落库需后端加明细表）。
 * 作答要求缺失时用模块库里的说明兜底。
 */
function toTrainModule(module: BackendProjectModule, templateDescription: string): TrainModule {
  const items = guideItems(module.items_json)
  const moduleId = String(module.id)
  const questions: TrainQuestion[] = items.length
    ? items.map((item, index) => ({
        id: questionId(moduleId, index),
        label: item.title,
        placeholder: item.prompt || '请按要点填写作答内容',
        maxLength: 2000,
        required: true,
      }))
    : [
        {
          id: questionId(moduleId, 0),
          label: '作答内容',
          placeholder: module.requirement ?? '请填写本关作答内容',
          maxLength: 4000,
          required: true,
        },
      ]

  return {
    id: moduleId,
    order: module.stage_no,
    name: module.stage_name,
    required: module.required,
    weight: toNumber(module.weight),
    requirement: module.requirement ?? templateDescription ?? '',
    description: templateDescription ?? '',
    // 后端没有独立的「验收标准」字段，先用填写要点当核对清单
    criteria: items.map((item) => item.title),
    // 后端没有「本关目标」字段
    goal: '',
    questions,
  }
}

function toProject(
  detail: BackendProjectDetail,
  templateDescriptions: Map<string, string>,
  record: BackendStudentProjectDetail | null,
  skillIds: string[],
): Project {
  const modules = detail.modules
    .slice()
    .sort((left, right) => left.stage_no - right.stage_no)
    .map((module) => toTrainModule(module, templateDescriptions.get(module.stage_key) ?? ''))

  const levelTotal = modules.length
  const latest = latestAttempt(record)
  const levelDone =
    record?.status === 'COMPLETED'
      ? levelTotal
      : Math.min(latest?.filled_stage_count ?? 0, levelTotal)
  const score = record
    ? toNumber(record.best_score ?? record.completed_score ?? record.total_score, 0)
    : 0

  return {
    id: String(detail.id),
    name: detail.project_name,
    tier: TIER_BY_LEVEL[detail.project_level] ?? 'basic',
    positionId: detail.job_id === null ? '' : String(detail.job_id),
    skillIds,
    status: record ? toProjectStatus(record.status) : 'not_started',
    levelTotal,
    levelDone,
    progress: levelTotal > 0 ? Math.round((levelDone / levelTotal) * 100) : 0,
    score: score > 0 ? score : undefined,
    intro: detail.description ?? '',
    modules,
    files: (detail.files ?? []).map((file) => ({
      id: String(file.id),
      fileKind: (file.file_kind as ProjectFile['fileKind']) ?? 'OTHER',
      title: file.title ?? file.original_name,
      originalName: file.original_name,
      contentType: file.content_type ?? '',
      sizeBytes: file.size_bytes,
      downloadUrl: resolveApiPath(file.download_url),
      remark: file.remark ?? undefined,
    })),
  }
}

function buildAiReview(
  submission: BackendSubmission | null,
  reviews: BackendReview[],
): AiReview | null {
  if (!submission) return null

  const finalReviews = reviews.filter((item) => item.status === 'FINAL')
  const aiReview = finalReviews.find((item) => item.review_kind === 'AI') ?? null
  const teacherReview = finalReviews.find((item) => item.review_kind === 'TEACHER') ?? null
  const rawScore = toNumber(
    submission.total_score ?? aiReview?.total_score ?? teacherReview?.total_score ?? null,
    Number.NaN,
  )
  const totalScore = Number.isFinite(rawScore) ? Math.round(rawScore) : undefined
  const dimensionSource =
    teacherReview && teacherReview.dimension_json.length > 0
      ? teacherReview.dimension_json
      : (aiReview?.dimension_json ?? [])
  const dimensions: AiReviewDimension[] = dimensionSource.map((item) => {
    const score = Math.round(toNumber(item.score, 0))
    return { name: item.name, score, reason: item.reason ?? '', passed: score >= 60 }
  })

  return {
    totalScore,
    grade: totalScore === undefined ? undefined : gradeOf(totalScore),
    dimensions,
    // 教师复审的评语单独展示，这里只放 AI 初审意见，避免同一段话出现两遍
    suggestion: aiReview?.comment ?? undefined,
    reviewStatus: toReviewStatus(submission.status),
    teacherScore: teacherReview ? Math.round(toNumber(teacherReview.total_score, 0)) : undefined,
    teacherComment: teacherReview?.comment ?? undefined,
    submissionStatus: submission.status as SubmissionStatus,
    submissionId: String(submission.id),
  }
}

async function buildWork(
  projectId: string,
  record: BackendStudentProjectDetail | null,
): Promise<ProjectWork> {
  const latest = latestAttempt(record)
  if (!record || !latest) {
    return {
      projectId,
      status: 'NONE',
      attemptId: null,
      attemptNo: 0,
      stages: [],
      submissionId: null,
      submissionStatus: null,
      objection: null,
      review: null,
      history: [],
      comments: [],
    }
  }

  const studentId = requireStudentId()
  const detail = await get<BackendAttemptDetail>(`/attempts/${latest.id}`)
  const submissions = await get<Page<BackendSubmission>>('/submissions', {
    query: { student_id: studentId, project_id: projectId, page_size: 200 },
  })
  const submission = submissions.items.find((item) => item.attempt_id === detail.id) ?? null
  const reviews = submission
    ? await get<BackendReview[]>(`/submissions/${submission.id}/reviews`)
    : []

  const stages: StageAnswer[] = detail.stages
    .slice()
    .sort((left, right) => left.stage_no - right.stage_no)
    .map((stage) => ({
      stageId: String(stage.id),
      moduleId: String(stage.project_module_id),
      order: stage.stage_no,
      name: stage.stage_name ?? `第 ${stage.stage_no} 关`,
      required: stage.required,
      weight: toNumber(stage.weight),
      isFilled: stage.is_filled,
      answerText: stage.answer_text ?? '',
      items: guideItems(stage.items_json),
      filledAt: stage.filled_at ?? undefined,
      fileCount: stage.file_count,
    }))

  const totalScore = submission ? Math.round(toNumber(submission.total_score, 0)) : 0

  const history: HistoryRecord[] = stages
    .filter((stage) => stage.isFilled)
    .map((stage) => ({
      id: `h-${stage.stageId}`,
      moduleId: stage.moduleId,
      moduleName: stage.name,
      at: stage.filledAt ? formatDateTime(stage.filledAt) : '',
      summary: answerSummary(stage.answerText) || '已提交作答',
      score: totalScore > 0 ? totalScore : undefined,
    }))

  // 教师点评：后端只有整单评审的评语，没有逐关点评
  const finalReviews = reviews.filter((item) => item.status === 'FINAL')
  const reviewerIds = [
    ...new Set(
      finalReviews
        .map((item) => item.reviewer_id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ]
  const reviewerNames = new Map<number, string>()
  await Promise.all(
    reviewerIds.map(async (id) => {
      const user = await get<{ id: number; real_name: string }>(`/users/${id}`)
      reviewerNames.set(id, user.real_name)
    }),
  )
  const comments: TeacherComment[] = finalReviews
    .filter((item) => item.review_kind !== 'AI' && Boolean(item.comment))
    .map((item) => ({
      id: `c-${item.id}`,
      moduleId: '',
      teacher: item.reviewer_id ? (reviewerNames.get(item.reviewer_id) ?? '任课教师') : '任课教师',
      at: formatDateTime(item.finished_at ?? item.created_at),
      content: item.comment ?? '',
      moduleName: '整单复审',
    }))

  return {
    projectId,
    status: detail.status as ProjectWork['status'],
    attemptId: String(detail.id),
    attemptNo: detail.attempt_no,
    stages,
    submissionId: submission ? String(submission.id) : null,
    submissionStatus: submission ? (submission.status as SubmissionStatus) : null,
    objection: submission?.objection_reason ?? null,
    review: buildAiReview(submission, reviews),
    history,
    comments,
  }
}

/* -------------------------------------------------------------------------- */
/* 对外接口                                                                    */
/* -------------------------------------------------------------------------- */

/** 学生可见的项目列表（只要已发布的）+ 本人进度 */
export async function fetchProjects(): Promise<Project[]> {
  const studentId = requireStudentId()
  const [list, templates, records] = await Promise.all([
    get<Page<BackendProjectBase>>('/projects', {
      query: { status: 'PUBLISHED', page_size: 200 },
    }),
    get<Page<BackendStageTemplate>>('/stage-templates', { query: { page_size: 200 } }),
    get<BackendStudentProjectDetail[]>(`/students/${studentId}/projects`),
  ])

  const templateDescriptions = new Map(
    templates.items.map((item) => [item.stage_key, item.description ?? '']),
  )
  const [details, skillLists] = await Promise.all([
    Promise.all(list.items.map((project) => get<BackendProjectDetail>(`/projects/${project.id}`))),
    Promise.all(
      list.items.map((project) =>
        get<BackendProjectSkillRef[]>(`/projects/${project.id}/skills`),
      ),
    ),
  ])

  return details.map((detail, index) =>
    toProject(
      detail,
      templateDescriptions,
      records.find((record) => record.project_id === detail.id) ?? null,
      (skillLists[index] ?? []).map((node) => String(node.id)),
    ),
  )
}

export async function fetchProject(projectId: string): Promise<Project | null> {
  const projects = await fetchProjects()
  return projects.find((item) => item.id === projectId) ?? null
}

/** 读取某个项目的闯关上下文（轮次、作答、提交、评审、历史、点评） */
export async function loadWork(projectId: string): Promise<ProjectWork> {
  const studentId = requireStudentId()
  const records = await get<BackendStudentProjectDetail[]>(`/students/${studentId}/projects`)
  const record = records.find((item) => String(item.project_id) === projectId) ?? null
  return buildWork(projectId, record)
}

/** 开始（或重新挑战）一个项目：后端会新建一轮，并在每关预建作答行 */
export async function startWork(projectId: string): Promise<ProjectWork> {
  const studentId = requireStudentId()
  await post(`/students/${studentId}/projects/${projectId}/start`)
  return loadWork(projectId)
}

/** 保存某一关的作答（整单提交后不能再改，后端会拦） */
export async function saveStageAnswer(params: {
  attemptId: string
  stageId: string
  answerText: string
  isFilled: boolean
}): Promise<void> {
  await patch(`/attempts/${params.attemptId}/stages/${params.stageId}`, {
    body: { answer_text: params.answerText, is_filled: params.isFilled },
  })
}

/** 整单提交：返回提交记录 ID 与状态 */
export async function submitWork(
  attemptId: string,
): Promise<{ submissionId: string; status: SubmissionStatus }> {
  const submission = await post<BackendSubmission>(`/attempts/${attemptId}/submit`)
  return { submissionId: String(submission.id), status: submission.status as SubmissionStatus }
}

/** 学生撤回本次提交（回到可编辑） */
export async function withdrawSubmission(submissionId: string): Promise<void> {
  await post(`/submissions/${submissionId}/withdraw`)
}

/** 对评审结果提异议（可留言），转教师复核 */
export async function raiseObjection(submissionId: string, reason: string): Promise<void> {
  await post(`/submissions/${submissionId}/objection`, { body: { reason } })
}
