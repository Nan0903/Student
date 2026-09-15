/**
 * 岗位（对接 training_platform）。
 *
 * 后端只存岗位主数据与「岗位需要哪些技能点」；匹配度不在数据里，
 * 由 stores/position.ts 按技能点进度现算（口径见 stores/skill.ts）。
 */

import { get, post, type Page } from './http'
import { requireStudentId } from './session'
import type { Position, PositionDifficulty } from '@/types'

interface BackendJob {
  id: number
  job_name: string
  direction_tag: string | null
  recommended_level: string | null
  scene: string | null
  description: string | null
  heat: number
  status: string
}

export interface BackendSkillNode {
  id: number
  node_name: string
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

/** 岗位所需技能点（后端：/jobs/{id}/skills） */
export async function fetchJobSkills(jobId: number | string): Promise<BackendSkillNode[]> {
  return get<BackendSkillNode[]>(`/jobs/${jobId}/skills`)
}

export async function fetchPositions(): Promise<Position[]> {
  const studentId = requireStudentId()
  const [jobs, myJobs] = await Promise.all([
    get<Page<BackendJob>>('/jobs', { query: { status: 'ENABLED', page_size: 200 } }),
    get<BackendStudentJob[]>(`/students/${studentId}/jobs`),
  ])

  const primaryJobId = myJobs.find((item) => item.is_primary)?.job_id ?? null
  const result: Position[] = []

  for (const job of jobs.items) {
    const nodes = await fetchJobSkills(job.id)
    const [levelFrom = '初级', levelTo = '中级'] = LEVEL_RANGE[job.recommended_level ?? 'BASIC'] ?? []
    result.push({
      id: String(job.id),
      name: job.job_name,
      direction: job.direction_tag ?? '其他方向',
      difficulty: DIFFICULTY_BY_LEVEL[job.recommended_level ?? 'BASIC'] ?? '中等',
      description: job.description ?? job.scene ?? '',
      levelFrom,
      levelTo,
      heat: job.heat,
      // 后端没有「已选人数」聚合接口，先按 0 展示
      selectedCount: 0,
      skillIds: nodes.map((node) => String(node.id)),
      selected: job.id === primaryJobId,
    })
  }
  return result
}

/** 确认选择岗位：设为该学生的主岗位（后端会自动清掉原主岗位） */
export async function selectPosition(positionId: string): Promise<Position[]> {
  const studentId = requireStudentId()
  await post(`/students/${studentId}/jobs`, {
    body: { job_id: Number(positionId), is_primary: true },
  })
  return fetchPositions()
}

/** 岗位需要的技能点 id 列表 */
export async function fetchPositionSkills(positionId: string): Promise<string[]> {
  const nodes = await fetchJobSkills(positionId)
  return nodes.map((node) => String(node.id))
}
