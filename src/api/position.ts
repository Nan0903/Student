/**
 * 岗位（对接 training_platform 的学生成长视图）。
 *
 * 一个接口拿全：`GET /api/students/{id}/job-recommendations`
 * —— 岗位主数据 + **后端算好的匹配度**（= 岗位技能点进度均值）+ 技能点与项目完成情况。
 * 匹配度不再由前端现算，推荐顺序也直接用后端的排序。
 */

import { get, post } from './http'
import { requireStudentId } from './session'
import type { Position, PositionDifficulty } from '@/types'

interface BackendJobSkill {
  skill_node_id: number
  node_name: string
  progress: number
}

interface BackendJobSkillGroup {
  tree_id: number
  tree_name: string | null
  skill_total_count: number
  skill_done_count: number
  skills: BackendJobSkill[]
}

interface BackendJobRecommendation {
  job_id: number
  job_name: string
  direction_tag: string | null
  recommended_level: string | null
  scene: string | null
  description: string | null
  heat: number
  match_score: number
  skill_total_count: number
  skill_done_count: number
  project_total_count: number
  project_done_count: number
  skill_groups: BackendJobSkillGroup[]
}

interface BackendStudentJob {
  job_id: number
  is_primary: boolean
}

const DIFFICULTY_BY_LEVEL: Record<string, PositionDifficulty> = {
  BASIC: '较易',
  ADVANCED: '中等',
  EXPANDED: '较难',
}

/** 岗位列表（含后端算好的匹配度与技能点画像），limit 取上限 50 拿到全部岗位 */
export async function fetchPositions(): Promise<Position[]> {
  const studentId = requireStudentId()
  const [recommendations, myJobs] = await Promise.all([
    get<BackendJobRecommendation[]>(`/students/${studentId}/job-recommendations`, {
      query: { limit: 50 },
    }),
    get<BackendStudentJob[]>(`/students/${studentId}/jobs`),
  ])

  const primaryJobId = myJobs.find((item) => item.is_primary)?.job_id ?? null

  return recommendations.map((job) => {
    return {
      id: String(job.job_id),
      name: job.job_name,
      direction: job.direction_tag ?? '其他方向',
      difficulty: DIFFICULTY_BY_LEVEL[job.recommended_level ?? 'BASIC'] ?? '中等',
      description: job.description ?? job.scene ?? '',
      heat: job.heat,
      // 后端没有「已选人数」聚合接口，先按 0 展示
      selectedCount: 0,
      skillIds: job.skill_groups.flatMap((group) =>
        group.skills.map((skill) => String(skill.skill_node_id)),
      ),
      selected: job.job_id === primaryJobId,
      percent: Math.round(job.match_score),
      skillTotal: job.skill_total_count,
      skillDone: job.skill_done_count,
      projectTotal: job.project_total_count,
      projectDone: job.project_done_count,
    }
  })
}

/** 确认选择岗位：设为该学生的主岗位（后端会自动清掉原主岗位） */
export async function selectPosition(positionId: string): Promise<Position[]> {
  const studentId = requireStudentId()
  await post(`/students/${studentId}/jobs`, {
    body: { job_id: Number(positionId), is_primary: true },
  })
  return fetchPositions()
}

/** 岗位需要的技能点 id 列表（后端推荐结果里已带，保留给需要单独取的场景） */
export async function fetchPositionSkills(positionId: string): Promise<string[]> {
  const positions = await fetchPositions()
  return positions.find((item) => item.id === positionId)?.skillIds ?? []
}

export interface LevelProjectProgress {
  /** BASIC / ADVANCED / EXPANDED */
  levelType: string
  levelName: string
  total: number
  completed: number
  percent: number
}

/**
 * 「实训进度概览」的分母口径：
 * - `ALL` 全部已发布项目（学生能看到并闯关任何一个）
 * - `SELF` 学生自己加进「我的实训」的项目
 * - `TEACHER` 老师发任务点名必修的项目
 */
export type ProjectProgressScope = 'ALL' | 'SELF' | 'TEACHER'

export interface ProjectProgress {
  scope: ProjectProgressScope
  total: number
  completed: number
  levels: LevelProjectProgress[]
}

interface BackendProjectProgress {
  student_id: number
  scope: string
  total: number
  completed: number
  levels: {
    level_type: string
    level_name: string
    total: number
    completed: number
    percent: number
  }[]
}

/**
 * 三档实训项目进度（成长中心「实训进度概览」用）。
 *
 * 分母由 `scope` 决定（全部已发布项目 / 我自主选择的 / 老师下发的），三种口径都只算已发布
 * 项目、都跟岗位无关；岗位维度的项目数看 Position 上的 projectTotal / projectDone。
 */
export async function fetchProjectProgress(
  scope: ProjectProgressScope = 'ALL',
): Promise<ProjectProgress> {
  const studentId = requireStudentId()
  const data = await get<BackendProjectProgress>(`/students/${studentId}/project-progress`, {
    query: { scope },
  })
  return {
    scope: (data.scope as ProjectProgressScope) ?? scope,
    total: data.total,
    completed: data.completed,
    levels: (data.levels ?? []).map((level) => ({
      levelType: level.level_type,
      levelName: level.level_name,
      total: level.total,
      completed: level.completed,
      percent: Math.round(level.percent),
    })),
  }
}
