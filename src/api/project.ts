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

import { questionId } from '@/utils/answer'
import { formatDateTime } from '@/utils/format'
import { resolveApiPath } from './file'
import { del, get, post, put, toNumber, type Page } from './http'
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

/** ---------- 学生项目详情（GET /students/{id}/projects/{pid}） ---------- */

interface BackendLevelDetail {
  project_module_id: number
  attempt_stage_id: number | null
  stage_no: number
  stage_name: string
  description: string | null
  requirement: string | null
  accept_standard: string | null
  weight: string | number
  required: boolean
  sub_titles: BackendItemsJson[] | null
  is_filled: boolean
  filled_at: string | null
  answer_text: string | null
  answer_saved_at: string | null
  file_count: number
}

interface BackendReviewHistory {
  review_id: number
  review_kind: string
  reviewer_id: number | null
  reviewer_name: string | null
  status: string
  version_no: number
  total_score: string | number | null
  conclusion: string | null
  comment: string | null
  dimensions: {
    name?: string | null
    score?: string | number | null
    weight?: string | number | null
    reason?: string | null
  }[]
  created_at: string
  finished_at: string | null
}

interface BackendSubmissionHistory {
  submission_id: number
  attempt_no: number
  submit_no: number
  status: string
  final_conclusion: string | null
  total_score: string | number | null
  submitted_at: string
  reviewed_at: string | null
  objection_reason: string | null
  is_starred: boolean
  reviews: BackendReviewHistory[]
}

interface BackendStudentProjectDetailFull {
  student_id: number
  project_id: number
  project_name: string
  project_level: string
  intro: string | null
  job_id: number | null
  job_name: string | null
  status: string
  best_score: string | number | null
  total_score: string | number | null
  progress: string | number
  level_total: number
  level_done: number
  attempt_count: number
  current_attempt_id: number | null
  current_attempt_no: number | null
  submission_count: number
  levels: BackendLevelDetail[]
  submissions: BackendSubmissionHistory[]
}

/** 保存作答的返回（PUT /attempts/{id}/answers） */
interface BackendSaveAnswersResult {
  attempt_id: number
  attempt_no: number
  saved_count: number
  filled_stage_count: number
  stage_total: number
  progress: string | number
}

/** AI 评审结果（POST /submissions/{id}/ai-review） */
interface BackendAiReviewOut {
  review: {
    id: number
    total_score: string | number | null
    conclusion: string | null
    comment: string | null
    status: string
    dimension_json: {
      name?: string | null
      score?: string | number | null
      reason?: string | null
    }[]
  }
  criteria_doc_ids: number[]
  recalled_chunks: number
  model: string
  warnings: string[]
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

/** 学生项目列表项（后端的 /students/{id}/training-projects） */
interface BackendStudentTrainingProject {
  project_id: number
  project_name: string
  project_level: string
  job_id: number | null
  job_name: string | null
  /** 是否在学生自己的「我的实训」清单里 */
  picked: boolean
  /** 是否老师发任务点名必修 */
  is_required: boolean
  required_deadline_at: string | null
  status: string
  best_score: string | number | null
  total_score: string | number | null
  progress: string | number
  level_total: number
  level_done: number
  skill_nodes: {
    skill_node_id: number
    node_name: string
    tree_id: number
    tree_name: string | null
  }[]
}

/** 列表项 → Project（不含关卡与附件，进详情页时再补） */
function toProjectListItem(item: BackendStudentTrainingProject): Project {
  const score = item.best_score === null ? undefined : Math.round(toNumber(item.best_score))
  return {
    id: String(item.project_id),
    name: item.project_name,
    tier: TIER_BY_LEVEL[item.project_level] ?? 'basic',
    positionId: item.job_id === null ? '' : String(item.job_id),
    positionName: item.job_name ?? undefined,
    skillIds: (item.skill_nodes ?? []).map((node) => String(node.skill_node_id)),
    picked: Boolean(item.picked),
    isRequired: Boolean(item.is_required),
    requiredDeadlineAt: item.required_deadline_at ?? undefined,
    status: toProjectStatus(item.status),
    levelTotal: item.level_total,
    levelDone: item.level_done,
    progress: Math.round(toNumber(item.progress)),
    score,
    // 简介 / 关卡 / 项目资料只有详情接口有，进入详情页时会补上
    intro: '',
    modules: [],
    files: [],
  }
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
    // 关卡简介来自模块库，按「关卡名称」关联：后端的编码列已删除，名称是唯一标识
    .map((module) => toTrainModule(module, templateDescriptions.get(module.stage_name) ?? ''))

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
    // 详情走的是教师侧的项目主数据：岗位名、是否自己挑的、是否必修都只有列表接口带，
    // 进详情时由 store 合并列表里那份（见 stores/project.ts 的 loadProject）。
    picked: false,
    isRequired: false,
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

/** 一次提交记录 → 判分面板要的 AiReview */
function toAiReview(submission: BackendSubmissionHistory): AiReview {
  const finalReviews = submission.reviews.filter((item) => item.status === 'FINAL')
  const aiReview = finalReviews.find((item) => item.review_kind === 'AI') ?? null
  const teacherReview = finalReviews.find((item) => item.review_kind === 'TEACHER') ?? null
  const rawScore = toNumber(
    submission.total_score ?? aiReview?.total_score ?? teacherReview?.total_score ?? null,
    Number.NaN,
  )
  const totalScore = Number.isFinite(rawScore) ? Math.round(rawScore) : undefined
  const dimensionSource =
    teacherReview && teacherReview.dimensions.length > 0
      ? teacherReview.dimensions
      : (aiReview?.dimensions ?? [])
  const dimensions: AiReviewDimension[] = dimensionSource.map((item) => {
    const score = Math.round(toNumber(item.score, 0))
    return { name: item.name ?? '评分项', score, reason: item.reason ?? '', passed: score >= 60 }
  })

  return {
    totalScore,
    grade: totalScore === undefined ? undefined : gradeOf(totalScore),
    dimensions,
    // 教师复审的评语由面板单独展示，这里只放 AI 初审意见，避免同一段话出现两遍
    suggestion: aiReview?.comment ?? undefined,
    reviewStatus: toReviewStatus(submission.status),
    teacherScore: teacherReview ? Math.round(toNumber(teacherReview.total_score, 0)) : undefined,
    teacherComment: teacherReview?.comment ?? undefined,
    submissionStatus: submission.status as SubmissionStatus,
    submissionId: String(submission.submission_id),
  }
}

/** 学生项目详情 → 页面要的闯关上下文（一个接口拿全，不再拼多次请求） */
function buildWork(projectId: string, detail: BackendStudentProjectDetailFull): ProjectWork {
  const stages: StageAnswer[] = [...(detail.levels ?? [])]
    .sort((left, right) => left.stage_no - right.stage_no)
    .map((level) => ({
      stageId: level.attempt_stage_id === null ? '' : String(level.attempt_stage_id),
      moduleId: String(level.project_module_id),
      order: level.stage_no,
      name: level.stage_name,
      required: level.required,
      weight: toNumber(level.weight),
      isFilled: level.is_filled,
      answerText: level.answer_text ?? '',
      items: (level.sub_titles ?? []).map((item) => ({
        title: item.title,
        prompt: item.prompt ?? '',
      })),
      filledAt: level.filled_at ?? level.answer_saved_at ?? undefined,
      fileCount: level.file_count,
    }))

  // 提交历史：后端按时间倒序返回，这里再兜一次排序
  const submissions = [...(detail.submissions ?? [])].sort((left, right) =>
    left.submitted_at < right.submitted_at ? 1 : -1,
  )
  const latest = submissions[0] ?? null

  const history: HistoryRecord[] = submissions.map((item) => {
    const score = item.total_score === null ? undefined : Math.round(toNumber(item.total_score))
    const conclusion =
      item.final_conclusion === 'PASS'
        ? '通过'
        : item.final_conclusion === 'FAIL'
          ? '未通过'
          : '待评审'
    return {
      id: `s-${item.submission_id}`,
      moduleId: '',
      moduleName: `第 ${item.attempt_no} 轮 · 第 ${item.submit_no} 次提交`,
      at: formatDateTime(item.submitted_at),
      summary: score === undefined ? conclusion : `${conclusion} · ${score} 分`,
      score,
    }
  })

  // 教师点评：取每次提交上的教师复审评语（AI 评语在判分面板里显示）
  const comments: TeacherComment[] = []
  for (const submission of submissions) {
    for (const review of submission.reviews) {
      if (review.review_kind === 'AI' || !review.comment) continue
      comments.push({
        id: `c-${review.review_id}`,
        moduleId: '',
        teacher: review.reviewer_name ?? '任课教师',
        at: formatDateTime(review.finished_at ?? review.created_at),
        content: review.comment,
        moduleName: `第 ${submission.attempt_no} 轮 · 第 ${submission.submit_no} 次`,
      })
    }
  }

  const status: ProjectWork['status'] =
    detail.current_attempt_id === null
      ? 'NONE'
      : detail.status === 'NOT_STARTED'
        ? 'IN_PROGRESS'
        : (detail.status as ProjectWork['status'])

  return {
    projectId,
    status,
    attemptId: detail.current_attempt_id === null ? null : String(detail.current_attempt_id),
    attemptNo: detail.current_attempt_no ?? 0,
    stages,
    submissionId: latest ? String(latest.submission_id) : null,
    submissionStatus: latest ? (latest.status as SubmissionStatus) : null,
    objection: latest?.objection_reason ?? null,
    review: latest ? toAiReview(latest) : null,
    history,
    comments,
  }
}

/* -------------------------------------------------------------------------- */
/* 对外接口                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 学生项目列表：用后端的学生成长视图接口一次拿全
 * （项目 + 我的最高分 / 关卡进度 / 所属岗位 / 关联技能点 / 状态）。
 *
 * 注意：列表接口不含 `modules` 与项目附件，这两样只有详情页需要，
 * 由 `fetchProject()` 按需补齐（见 stores/project.ts 的 loadProject）。
 */
export async function fetchProjects(): Promise<Project[]> {
  const studentId = requireStudentId()
  const items = await get<BackendStudentTrainingProject[]>(
    `/students/${studentId}/training-projects`,
  )
  return items.map(toProjectListItem)
}

/** 单个项目的全量数据（含关卡组成与项目资料），详情页进入时调用 */
export async function fetchProject(projectId: string): Promise<Project | null> {
  const studentId = requireStudentId()
  const [detail, skills, templates, records] = await Promise.all([
    get<BackendProjectDetail>(`/projects/${projectId}`),
    get<BackendProjectSkillRef[]>(`/projects/${projectId}/skills`),
    get<Page<BackendStageTemplate>>('/stage-templates', { query: { page_size: 200 } }),
    get<BackendStudentProjectDetail[]>(`/students/${studentId}/projects`),
  ])

  const templateDescriptions = new Map(
    templates.items.map((item) => [item.stage_name, item.description ?? '']),
  )
  return toProject(
    detail,
    templateDescriptions,
    records.find((record) => String(record.project_id) === projectId) ?? null,
    skills.map((node) => String(node.id)),
  )
}

/**
 * 读取某个项目的闯关上下文。
 *
 * 用后端的学生项目详情接口一次拿全：任务简介、关卡与子标题、每关作答与附件数、
 * 提交历史与每次提交上的 AI / 教师评语。
 */
export async function loadWork(projectId: string): Promise<ProjectWork> {
  const studentId = requireStudentId()
  const detail = await get<BackendStudentProjectDetailFull>(
    `/students/${studentId}/projects/${projectId}`,
  )
  return buildWork(projectId, detail)
}

/** 开始（或重新挑战）一个项目：后端会新建一轮，并在每关预建作答行 */
export async function startWork(projectId: string): Promise<ProjectWork> {
  const studentId = requireStudentId()
  await post(`/students/${studentId}/projects/${projectId}/start`)
  return loadWork(projectId)
}

/**
 * 把项目加进「我的实训」（技能树节点详情里的「+」）。
 *
 * 后端是批量、幂等接口：已经加过的跳过；项目没发布会被拒绝。
 * 加入清单不影响技能进度，也不影响闯关记录（清单只是"我要练这些"）。
 */
export async function addToMyProjects(projectIds: string[]): Promise<void> {
  const studentId = requireStudentId()
  await post(`/students/${studentId}/my-projects`, {
    body: { project_ids: projectIds.map((id) => Number(id)) },
  })
}

/**
 * 从「我的实训」移出。
 *
 * 幂等；如果这个项目同时是老师点名的必修，移出后仍会出现在列表里（必修是任务实时算的），
 * 后端会在 msg 里说明这一点。闯关记录、成绩、技能进度都不受影响。
 */
export async function removeFromMyProjects(projectId: string): Promise<void> {
  const studentId = requireStudentId()
  await del(`/students/${studentId}/my-projects/${projectId}`)
}

/**
 * 保存作答（一次可存多个关卡）。
 *
 * 后端语义：只更新 body 里带到的关卡，默认只存文本、**不改关卡完成状态**；
 * 想把某关标记为完成，在该条目上传 `isFilled: true`。
 */
export async function saveAnswers(
  attemptId: string,
  items: { stageId: string; answerText: string; isFilled: boolean }[],
): Promise<BackendSaveAnswersResult> {
  return put<BackendSaveAnswersResult>(`/attempts/${attemptId}/answers`, {
    body: {
      answers: items
        .filter((item) => item.stageId)
        .map((item) => ({
          attempt_stage_id: Number(item.stageId),
          answer_text: item.answerText,
          is_filled: item.isFilled,
        })),
    },
  })
}

/** 保存某一关的作答（单关场景，内部走批量接口） */
export async function saveStageAnswer(params: {
  attemptId: string
  stageId: string
  answerText: string
  isFilled: boolean
}): Promise<void> {
  await saveAnswers(params.attemptId, [
    { stageId: params.stageId, answerText: params.answerText, isFilled: params.isFilled },
  ])
}

/**
 * 触发 AI 评审：后端召回本项目评分标准 → 大模型打分 → 落库并结算
 * （分数过线则项目完成、技能进度重算）。
 */
export async function runAiReview(
  submissionId: string,
): Promise<{ score?: number; model: string; warnings: string[] }> {
  const outcome = await post<BackendAiReviewOut>(`/submissions/${submissionId}/ai-review`)
  const raw = toNumber(outcome.review?.total_score ?? null, Number.NaN)
  return {
    score: Number.isFinite(raw) ? Math.round(raw) : undefined,
    model: outcome.model,
    warnings: outcome.warnings ?? [],
  }
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
