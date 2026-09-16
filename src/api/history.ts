/**
 * 历史记录：跨项目的整单提交记录与每次提交上的评审。
 *
 * 数据来源（后端 training_platform）：
 * - 提交记录 `GET /submissions?student_id=`：分页，返回体为统一分页结构，按提交时间倒序；
 * - 提交评审 `GET /submissions/{id}/reviews`：一条提交对应 AI / 教师两条评审记录；
 * - 项目维度（状态、关卡进度、最高分）由 `api/project.ts` 的 `fetchProjects` 提供，本模块不重复实现。
 *
 * 约定：
 * - 评审按提交逐条拉取，调用方应做懒加载（展开某一行时才请求），避免列表页产生 N 次请求；
 * - 后端评审记录只带 `reviewer_id`，教师姓名由本模块按需换取并缓存于单次调用内。
 */

import { get, toNumber, type Page } from './http'
import { requireStudentId } from './session'
import type { SubmissionStatus } from '@/types'

/** 整单提交记录（列表行） */
export interface SubmissionRecord {
  id: string
  attemptId: string
  /** 所属闯关轮次序号（重新挑战会 +1） */
  attemptNo: number
  /** 轮次内的提交序号（撤回后重新提交会 +1） */
  submitNo: number
  projectId: string
  projectName: string
  status: SubmissionStatus
  conclusion: 'PASS' | 'FAIL' | null
  totalScore?: number
  objection?: string
  isStarred: boolean
  submittedAt: string
  reviewedAt?: string
  withdrawnAt?: string
}

/** 评审记录（`AI` 自动评审 / `TEACHER` 教师复审） */
export interface SubmissionReview {
  id: string
  kind: 'AI' | 'TEACHER'
  reviewer: string | null
  score?: number
  conclusion: string | null
  comment?: string
  dimensions: { name: string; score?: number; reason?: string }[]
  finishedAt?: string
}

interface BackendSubmissionRow {
  id: number
  attempt_id: number
  attempt_no: number | null
  submit_no: number
  project_id: number | null
  project_name: string | null
  status: string
  final_conclusion: string | null
  total_score: string | number | null
  objection_reason: string | null
  is_starred: boolean
  submitted_at: string | null
  reviewed_at: string | null
  withdrawn_at: string | null
}

interface BackendReviewRow {
  id: number
  review_kind: string
  status: string
  reviewer_id: number | null
  total_score: string | number | null
  conclusion: string | null
  comment: string | null
  dimension_json: {
    name?: string | null
    score?: string | number | null
    reason?: string | null
  }[]
  finished_at: string | null
  created_at: string
}

export interface SubmissionQuery {
  page?: number
  pageSize?: number
  /** 按项目过滤，值为项目 ID；空表示全部项目 */
  projectId?: string
  /** 按提交状态过滤，取值见 `/enums` 的 `submission_status` */
  status?: string
}

/**
 * 查询当前学生的提交记录。
 *
 * @param query 分页与过滤条件；`student_id` 由登录态注入，调用方无需传
 * @returns 统一分页结构，`items` 已映射为前端模型（分数取整、无值时为 `undefined`）
 */
export async function fetchSubmissions(query: SubmissionQuery = {}): Promise<Page<SubmissionRecord>> {
  const studentId = requireStudentId()
  const page = await get<Page<BackendSubmissionRow>>('/submissions', {
    query: {
      student_id: studentId,
      project_id: query.projectId,
      status: query.status,
      page: query.page ?? 1,
      page_size: query.pageSize ?? 10,
    },
  })

  return {
    ...page,
    items: page.items.map((row) => ({
      id: String(row.id),
      attemptId: String(row.attempt_id),
      attemptNo: row.attempt_no ?? 1,
      submitNo: row.submit_no,
      projectId: row.project_id === null ? '' : String(row.project_id),
      projectName: row.project_name ?? '未知项目',
      status: row.status as SubmissionStatus,
      conclusion:
        row.final_conclusion === 'PASS' || row.final_conclusion === 'FAIL'
          ? row.final_conclusion
          : null,
      totalScore:
        row.total_score === null ? undefined : Math.round(toNumber(row.total_score)),
      objection: row.objection_reason ?? undefined,
      isStarred: row.is_starred,
      submittedAt: row.submitted_at ?? '',
      reviewedAt: row.reviewed_at ?? undefined,
      withdrawnAt: row.withdrawn_at ?? undefined,
    })),
  }
}

/**
 * 查询某次提交的全部评审，按创建时间正序（AI 在前、教师复审在后）。
 *
 * @param submissionId 提交记录 ID
 * @returns 评审列表；教师姓名已解析（解析不到时回落为「任课教师」）
 */
export async function fetchSubmissionReviews(submissionId: string): Promise<SubmissionReview[]> {
  const rows = await get<BackendReviewRow[]>(`/submissions/${submissionId}/reviews`)
  // 评审记录不含教师姓名，按去重后的 reviewer_id 补齐（单次提交通常只有 1~2 位教师）
  const reviewerIds = [
    ...new Set(rows.map((row) => row.reviewer_id).filter((id): id is number => id !== null)),
  ]
  const names = new Map<number, string>()
  await Promise.all(
    reviewerIds.map(async (id) => {
      const user = await get<{ id: number; real_name: string }>(`/users/${id}`)
      names.set(id, user.real_name)
    }),
  )

  return rows
    .slice()
    .sort((left, right) => (left.created_at < right.created_at ? -1 : 1))
    .map((row) => ({
      id: String(row.id),
      kind: row.review_kind === 'AI' ? 'AI' : 'TEACHER',
      reviewer: row.reviewer_id === null ? null : (names.get(row.reviewer_id) ?? '任课教师'),
      score: row.total_score === null ? undefined : Math.round(toNumber(row.total_score)),
      conclusion: row.conclusion,
      comment: row.comment ?? undefined,
      dimensions: (row.dimension_json ?? []).map((item) => ({
        name: item.name ?? '评分项',
        score: item.score === null || item.score === undefined ? undefined : Math.round(toNumber(item.score)),
        reason: item.reason ?? undefined,
      })),
      finishedAt: row.finished_at ?? row.created_at,
    }))
}
