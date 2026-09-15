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
  node_code: string
  node_name: string
  progress: number
}

interface BackendJobSkillGroup {
  tree_id: number
  tree_code: string | null
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

/** 等级区间文案：按后端 recommended_level 映射 */
const LEVEL_RANGE: Record<string, [string, string]> = {
  BASIC: ['初级', '中级'],
  ADVANCED: ['中级', '高级'],
  EXPANDED: ['高级', '资深'],
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
    const [levelFrom = '初级', levelTo = '中级'] =
      LEVEL_RANGE[job.recommended_level ?? 'BASIC'] ?? []
    return {
      id: String(job.job_id),
      name: job.job_name,
      direction: job.direction_tag ?? '其他方向',
      difficulty: DIFFICULTY_BY_LEVEL[job.recommended_level ?? 'BASIC'] ?? '中等',
      description: job.description ?? job.scene ?? '',
      levelFrom,
      levelTo,
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

export interface JobProjectProgress {
  jobId: number | null
  jobName: string | null
  isPrimary: boolean
  total: number
  completed: number
  levels: LevelProjectProgress[]
}

interface BackendJobProjectProgress {
  job_id: number | null
  job_name: string | null
  is_primary: boolean
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

/** 当前岗位下三档实训项目的进度（成长中心「实训进度概览」用） */
export async function fetchJobProjectProgress(): Promise<JobProjectProgress> {
  const studentId = requireStudentId()
  const data = await get<BackendJobProjectProgress>(
    `/students/${studentId}/job-project-progress`,
  )
  return {
    jobId: data.job_id,
    jobName: data.job_name,
    isPrimary: data.is_primary,
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
