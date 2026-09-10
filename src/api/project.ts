/** 实训项目、关卡提交与 AI 判分 */

import { mockRequest } from '@/utils/request'
import {
  aiSuggestionPool,
  historyRecords,
  projects,
  teacherComments,
} from '@/mock/data'
import type {
  AiReview,
  AiReviewDimension,
  HistoryRecord,
  Project,
  SubmitModulePayload,
  TeacherComment,
} from '@/types'

export function fetchProjects(): Promise<Project[]> {
  return mockRequest({ resolve: () => projects.map((item) => ({ ...item })) })
}

export function fetchProject(projectId: string): Promise<Project | null> {
  return mockRequest({ resolve: () => projects.find((item) => item.id === projectId) ?? null })
}

export function fetchHistory(projectId: string): Promise<HistoryRecord[]> {
  return mockRequest({
    delay: [200, 350],
    resolve: () => historyRecords.filter((item) => item.moduleId.startsWith(`${projectId}-`)),
  })
}

export function fetchTeacherComments(projectId: string): Promise<TeacherComment[]> {
  return mockRequest({
    delay: [200, 350],
    resolve: () => teacherComments.filter((item) => item.moduleId.startsWith(`${projectId}-`)),
  })
}

/* -------------------------------------------------------------------------- */
/* AI 判分（Mock）：结果由作答内容推导，保证同样的作答得到同样的分数            */
/* -------------------------------------------------------------------------- */

const DIMENSION_NAMES = ['需求理解', '方案合理性', '数据与依据', '表达规范'] as const

function hashCode(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 100000
  }
  return hash
}

function buildReview(payload: SubmitModulePayload): AiReview {
  const answerText = Object.values(payload.textAnswers).join('')
  const answerLength = answerText.length
  const fileBonus = Math.min(payload.files.length, 3) * 2
  const lengthScore = Math.min(20, Math.floor(answerLength / 25))
  const jitter = hashCode(answerText) % 5
  const base = 72 + lengthScore + fileBonus + jitter
  const totalScore = Math.max(60, Math.min(98, base))

  const dimensions: AiReviewDimension[] = DIMENSION_NAMES.map((name, index) => {
    const offset = ((hashCode(`${payload.moduleId}${name}`) % 7) - 3) + index
    const score = Math.max(55, Math.min(100, totalScore + offset))
    const passed = score >= 75
    return {
      name,
      score,
      passed,
      reason: passed
        ? `${name}符合本关要求，要点覆盖完整，可以进入下一关的准备工作。`
        : `${name}达到基本要求，但关键要素仍有缺口，建议按验收标准逐条补齐后再提交。`,
    }
  })

  const grade = totalScore >= 90 ? '优秀' : totalScore >= 80 ? '良好' : '合格'
  return {
    totalScore,
    grade,
    dimensions,
    suggestion: aiSuggestionPool[hashCode(payload.moduleId) % aiSuggestionPool.length] ?? aiSuggestionPool[0]!,
    reviewStatus: 'passed',
  }
}

/** 提交关卡作答 → AI 自动评判（判分动效 1–2 秒） */
export function submitModule(payload: SubmitModulePayload): Promise<AiReview> {
  return mockRequest({
    delay: [1100, 1800],
    resolve: () => buildReview(payload),
  })
}

/** 申请教师复评 → 状态变为「待复审」 */
export function requestRecheck(review: AiReview): Promise<AiReview> {
  return mockRequest({
    delay: [300, 600],
    resolve: () => ({ ...review, reviewStatus: 'pending_recheck' }),
  })
}

/** 教师保存复审（学生端只读取结果，Mock 用于演示「已复审」态） */
export function applyTeacherRecheck(review: AiReview): Promise<AiReview> {
  return mockRequest({
    delay: [300, 600],
    resolve: () => ({
      ...review,
      reviewStatus: 'rechecked',
      teacherScore: Math.min(100, review.totalScore + 3),
      teacherComment:
        '已复核你的作答。整体思路成立，补充的现场数据能支撑结论，分数按复评结果调整。',
    }),
  })
}
